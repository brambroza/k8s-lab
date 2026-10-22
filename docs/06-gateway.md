# 06 — Application Gateway บนเครื่องเดียว

> ฉบับ public: IP `192.0.2.10`, hostname `lab-control-plane` และ user `labadmin` เป็นค่าตัวอย่าง ไม่ใช่ข้อมูลเครื่องจริง ต้องแทนด้วยค่าของคุณก่อนรันคำสั่ง (192.0.2.0/24 เป็น TEST-NET สำหรับเอกสาร)

Gateway เป็นขั้นต่อยอด ยังไม่ได้ deploy บน Server จริง
เลือก **Envoy Gateway v1.8.5 + Gateway API + NodePort** สำหรับ LAN lab
ไม่ต้องมี cloud LoadBalancer หรือ MetalLB และไม่แก้ default route ของ Linux

โครงสร้าง: Browser → NodeIP:NodePort → Envoy → HTTPRoute → Service → Pod
หนึ่ง Gateway รับหลาย hostname ได้ ไม่ต้องติดตั้ง controller ใหม่ทุกครั้งที่เพิ่มแอป

## 1. ติดตั้ง controller

ต้องมี Helm ก่อน: https://helm.sh/docs/intro/install/
เครื่องสำหรับแล็บ ควรดู free -h และ kubectl describe node ก่อนเพิ่ม controller
```bash
helm version
helm upgrade --install eg oci://docker.io/envoyproxy/gateway-helm \
  --version v1.8.5 -n envoy-gateway-system --create-namespace --wait --timeout 5m
kubectl -n envoy-gateway-system get pods
kubectl get crd gateways.gateway.networking.k8s.io
```

chart นี้ติดตั้ง Gateway API CRDs ด้วย หากมี controller/CRDs จากระบบอื่นแล้วให้ตรวจ compatibility ก่อน
ใช้ namespace envoy-gateway-system ค่าเริ่มต้น; ไม่เปิด Gateway namespace mode ในแล็บนี้

## 2. สร้าง Gateway และ route

ต้องมี namespace lab / Podinfo จากบท 04 ก่อน
```bash
kubectl apply --dry-run=server -f manifests/gateway/gateway.yaml
kubectl apply -f manifests/gateway/gateway.yaml
kubectl apply -f manifests/gateway/podinfo-route.yaml
kubectl -n lab get gateway,httproute
kubectl -n lab describe gateway lab-gateway
kubectl -n lab describe httproute podinfo
```

Gateway ควร Accepted/Programmed และ HTTPRoute parent status ควร Accepted=True / ResolvedRefs=True
ถ้ายังไม่พร้อมใช้ describe ดู conditions ไม่เดาว่าเป็น DNS อย่างเดียว

## 3. หาพอร์ตจริง

```bash
kubectl -n envoy-gateway-system get svc \
  -l gateway.envoyproxy.io/owning-gateway-name=lab-gateway,gateway.envoyproxy.io/owning-gateway-namespace=lab

ENVOY_SERVICE=$(kubectl -n envoy-gateway-system get svc \
  -l gateway.envoyproxy.io/owning-gateway-name=lab-gateway,gateway.envoyproxy.io/owning-gateway-namespace=lab \
  -o jsonpath='{.items[0].metadata.name}')

NODE_PORT=$(kubectl -n envoy-gateway-system get svc "$ENVOY_SERVICE" \
  -o jsonpath='{.spec.ports[?(@.port==80)].nodePort}')

printf 'HTTP NodePort: %s\n' "$NODE_PORT"
curl -i -H 'Host: podinfo.lab.test' "http://192.0.2.10:$NODE_PORT/"
```

NodePort เป็นค่าที่ Kubernetes จัดสรร อย่า copy เลขตัวอย่างโดยไม่ตรวจ
หากเปลี่ยน Service ใหม่อาจได้เลขใหม่
อนุญาต TCP เฉพาะ NodePort ที่ได้จาก LAN ที่ไว้ใจ ไม่เปิดทั้ง range สู่ Internet

## 4. เปิดจาก Mac

แก้ /etc/hosts บน Mac:
```text
192.0.2.10 podinfo.lab.test api.lab.test
```

เข้า `http://podinfo.lab.test:<NODE_PORT>/` โดยแทน <NODE_PORT> ด้วยค่าจริง
การเข้า IP ตรง ๆ ไม่มี Host header ตรง route อาจได้ 404

ถ้า LAN ไม่เปิด NodePort ใช้ tunnel จาก Mac:
```bash
# แทนเลข 30xxx ด้วย NodePort จริง
ssh -N -L 9080:192.0.2.10:30xxx labadmin@192.0.2.10
curl -H 'Host: podinfo.lab.test' http://localhost:9080/
```

## 5. NetworkPolicy ที่เคยฝึกอาจบล็อก Gateway

```bash
kubectl apply -f manifests/policies/podinfo-allow.yaml
kubectl -n envoy-gateway-system get pods --show-labels
```

allow manifest อนุญาต client role=tester และ Envoy ของ lab-gateway เท่านั้น
หากเลือก namespace/deployment mode ของ Envoy ต่างจากค่าเริ่มต้น ต้องแก้ namespaceSelector/podSelector ให้ตรง

## 6. เพิ่มแอปใหม่

สร้าง Deployment + Service ตามบท 07 แล้ว:
```bash
kubectl apply -f manifests/gateway/demo-api-route.yaml
curl -H 'Host: api.lab.test' "http://192.0.2.10:$NODE_PORT/"
```

route ใช้ Service port 80 ไม่ใช่ container port 3000
เปลี่ยน image ของแอปเดิมไม่ต้องแก้ Gateway ถ้า Service/port เดิมยังเหมือนเดิม

## 7. HTTPS (ทางเลือกหลัง HTTP ผ่าน)

ใช้โดเมนจริงและ certificate ที่เชื่อถือได้ หรือ local CA ที่ติดตั้งใน Mac สำหรับ .test
สร้าง Secret ใน lab จากไฟล์ภายนอก repo (ห้าม commit key):
```bash
kubectl -n lab create secret tls lab-tls --cert=/path/to/tls.crt --key=/path/to/tls.key
```

เพิ่ม listener ใต้ spec.listeners ของ gateway.yaml:
```yaml
- name: https
  protocol: HTTPS
  port: 443
  hostname: podinfo.lab.test
  tls:
    mode: Terminate
    certificateRefs:
      - kind: Secret
        name: lab-tls
  allowedRoutes:
    namespaces:
      from: Same
```

apply Gateway แล้วเพิ่ม parentRef ของ podinfo HTTPRoute ที่ sectionName=https
อ่าน NodePort ของ port 443 แล้วเปิด https://podinfo.lab.test:<HTTPS_NODE_PORT>
certificate ต้องมี SAN ตรง hostname; ไม่ใช้ -k เป็นวิธีแก้ถาวร
การเพิ่ม HTTPS ไม่ redirect HTTP อัตโนมัติ ต้องเพิ่ม HTTPRoute RequestRedirect แยกหากต้องการ
