# 09 — Troubleshooting จากแล็บจริง

> ฉบับ public: IP `192.0.2.10`, hostname `lab-control-plane` และ user `labadmin` เป็นค่าตัวอย่าง ไม่ใช่ข้อมูลเครื่องจริง ต้องแทนด้วยค่าของคุณก่อนรันคำสั่ง (192.0.2.0/24 เป็น TEST-NET สำหรับเอกสาร)

## kubectl timeout ไป 198.51.100.10
ทั้งสอง IP ในบทนี้เป็นค่าตัวอย่าง: เหตุการณ์จริงเกิดจาก kubeconfig และ certificate ชี้ IP ที่ไม่ได้อยู่บนเครื่อง ต้องตรวจ IP จริงด้วยคำสั่งด้านล่าง
ตรวจ:
```bash
hostname -I
kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'; echo
sudo grep -- '--advertise-address' /etc/kubernetes/manifests/kube-apiserver.yaml
sudo openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -ext subjectAltName
```
หาก init ด้วย IP ผิด ทั้ง manifests/certificates/etcd อาจเกี่ยวข้อง ไม่แก้ kubeconfig อย่างเดียว
แล็บใหม่ที่ไม่มีข้อมูลได้ reset/init ใหม่แล้ว แต่ repo นี้ไม่ใส่ reset เป็นขั้นตอนปกติ

## Operator CrashLoopBackOff / mapServed=false
ดูบท 03; เปิด MAP API ก่อน apply CRDs/policies และ restart Operator

## API connection refused หลังแก้ static Pod
อาจอยู่ระหว่าง restart ไม่ได้แปลว่า YAML ผิดเสมอ
สำรองไฟล์ไว้นอก /etc/kubernetes/manifests เท่านั้น
```bash
sudo mkdir -p /root/k8s-backup
sudo cp /etc/kubernetes/manifests/kube-apiserver.yaml /root/k8s-backup/kube-apiserver.yaml
```
เมื่อแก้แล้วตรวจ readiness:
```bash
kubectl --request-timeout=3s get --raw='/readyz'
sudo ss -lntp | grep ':6443'
sudo journalctl -u kubelet -n 80 --no-pager
sudo crictl --runtime-endpoint unix:///run/containerd/containerd.sock ps -a --name kube-apiserver
```
อ่าน log ด้วย ID ที่พบ:
```bash
sudo crictl --runtime-endpoint unix:///run/containerd/containerd.sock logs --tail=100 CONTAINER_ID
```
ถ้า command not found ติดตั้ง sudo apt-get install -y cri-tools
warning ว่า /etc/crictl.yaml ไม่มี ไม่ทำให้ล้มเมื่อส่ง --runtime-endpoint แล้ว
ดู log ก่อนสรุปเหตุ; container เก่าที่ถูก garbage collect อาจไม่เหลือให้ตรวจ

## Pod Pending
```bash
kubectl -n lab describe pod POD_NAME
kubectl describe node lab-control-plane
```
ดู taint, resource shortage, selector; single-node ต้องปลด control-plane NoSchedule ตามบท 02

## SSH เงียบ / หน้าเว็บไม่ขึ้น
ssh -N เงียบตามปกติ เปิด terminal ค้างไว้
Mac 9090 → Server 8080 → Service 80 → Pod 9898
อย่าชี้ปลายทาง tunnel ไป 9090 ถ้า Server port-forward เปิด 8080
Address already in use ให้เปลี่ยนพอร์ตด้านที่ชน ไม่ต้องเปลี่ยนทุกชั้น

## ImagePullBackOff / exec format error
ดู tag, registry auth, imagePullSecrets และ platform
Mac M2 สร้าง ARM image โดย default; Server นี้ต้อง linux/amd64

## Gateway 404 / 503 / timeout
- 404: Host header, hostname, listener และ route attachment
- 503: Service endpoints, app readiness, NetworkPolicy
- timeout: NodePort, firewall, routing, Envoy Pod readiness
```bash
kubectl -n lab describe httproute podinfo
kubectl -n lab get endpointslices -l kubernetes.io/service-name=podinfo
kubectl -n lab get networkpolicy
kubectl -n envoy-gateway-system get pods,svc
```

## อย่าใช้คำสั่งแก้แบบเหมา

ไม่ flush firewall, ไม่ chmod kubeconfig เป็น 777, ไม่ disable TLS verify,
ไม่ลบ /var/lib/etcd และไม่ kubeadm reset เพื่อแก้ image/network policy error
