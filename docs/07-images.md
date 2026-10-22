# 07 — เพิ่ม image / container / แอปใหม่

> ฉบับ public: IP `192.0.2.10`, hostname `lab-control-plane` และ user `labadmin` เป็นค่าตัวอย่าง ไม่ใช่ข้อมูลเครื่องจริง ต้องแทนด้วยค่าของคุณก่อนรันคำสั่ง (192.0.2.0/24 เป็น TEST-NET สำหรับเอกสาร)

## เลือกกรณีให้ถูก

| ความต้องการ | สิ่งที่แก้ |
|---|---|
| แอปเดิมเวอร์ชันใหม่ | Deployment image tag/digest แล้ว rollout |
| เพิ่มจำนวน instance | replicas ของ Deployment |
| แอปใหม่แยก lifecycle | Deployment + Service ใหม่; HTTPRoute หากต้องรับจาก Gateway |
| sidecar ที่ต้องอยู่/scale พร้อมแอป | เพิ่ม containers ใน Pod template เดียวกัน |
| container ชั่วคราว debug | debug workflow; ไม่สร้าง production workload ด้วย docker run |

Docker image ใน Mac หรือ Docker Engine ของ Server **ไม่ปรากฏใน containerd ของ Kubernetes อัตโนมัติ**
แนะนำ push registry แล้วให้ Kubernetes pull
Server นี้ amd64 แต่ Mac M2 arm64 จึงต้อง build --platform linux/amd64 หรือ multi-arch

## A. Build และ push demo API

ต้องมี Docker/Buildx บนเครื่อง build และสิทธิ์ push GHCR
ตัวอย่างใช้ namespace brambroza ซึ่งต้องมีสิทธิ์จริง
ล็อกอินด้วย GitHub token ผ่าน prompt (ไม่ใส่ token ในคำสั่ง/ไฟล์ repo):
```bash
docker login ghcr.io -u brambroza
docker buildx build --platform linux/amd64 \
  -t ghcr.io/brambroza/k8s-lab-demo-api:1.0.0 \
  --push examples/demo-api
```

ตัวอย่าง image นี้ไม่ได้ถูกสร้าง/push ให้โดยการสร้าง repository ต้องทำคำสั่ง build เอง
ถ้าใช้ package public ให้ตรวจ package visibility (repo public ไม่ได้ทำให้ package public เสมอ)

Dockerfile ใช้ node:22-alpine สำหรับแล็บ; งาน production ควรล็อก base digest หลังตรวจ scan แล้ว
สำหรับ multi-arch เปลี่ยน --platform เป็น linux/amd64,linux/arm64

## B. Private registry

ใช้ read-only pull credentials แยกจาก push credentials
สร้าง Docker config ในพื้นที่ชั่วคราวนอก repo ด้วย Docker login:
```bash
PULL_CONFIG_DIR=$(mktemp -d)
chmod 700 "$PULL_CONFIG_DIR"
docker --config "$PULL_CONFIG_DIR" login ghcr.io -u brambroza
kubectl -n lab create secret generic ghcr-pull \
  --type=kubernetes.io/dockerconfigjson \
  --from-file=.dockerconfigjson="$PULL_CONFIG_DIR/config.json"
rm -rf "$PULL_CONFIG_DIR"
```

ทำบนเครื่องที่มีทั้ง Docker CLI และ kubectl ที่เชื่อม cluster แล้ว
ใช้ token ที่มีสิทธิ์ read:packages เท่าที่จำเป็น; config นี้ต้องมี auth ในไฟล์จริงไม่ใช่ credential-helper reference
ถ้า Secret มีอยู่แล้ว ให้วางแผน rotation แทนการลบขณะใช้งาน
uncomment imagePullSecrets ใน manifests/apps/demo-api.yaml
อย่า commit Secret ที่ encode base64 เพราะไม่ใช่ encryption

## C. Deploy แอปใหม่

หลัง image มีใน registry:
```bash
kubectl apply --dry-run=server -f manifests/apps/demo-api.yaml
kubectl apply -f manifests/apps/demo-api.yaml
kubectl -n lab rollout status deployment/demo-api --timeout=180s
kubectl -n lab get pods -l app=demo-api
kubectl -n lab port-forward svc/demo-api 8081:80
```

Mac:
```bash
ssh -N -L 9091:127.0.0.1:8081 labadmin@192.0.2.10
curl http://localhost:9091/
```

ถ้าติดตั้ง Gateway แล้ว apply demo-api-route.yaml ตามบท 06

## D. อัปเดต image เดิม

1. แก้ source
2. build/push tag ใหม่ เช่น 1.0.1 ห้ามทับ tag เดิมในงานที่ต้อง audit
3. แก้ image และ APP_VERSION ใน manifests/apps/demo-api.yaml
4. dry-run และ apply:
```bash
kubectl apply --dry-run=server -f manifests/apps/demo-api.yaml
kubectl apply -f manifests/apps/demo-api.yaml
kubectl -n lab rollout status deployment/demo-api --timeout=180s
kubectl -n lab rollout history deployment/demo-api
```
5. ทดสอบ HTTP และ commit manifest ที่ตรงกับ deployment

ทางลัดสำหรับทดลอง:
```bash
kubectl -n lab set image deployment/demo-api demo-api=ghcr.io/brambroza/k8s-lab-demo-api:1.0.1
```
คำสั่งนี้ไม่แก้ Git และไม่อัปเดต APP_VERSION; ต้องกลับมาแก้ manifest ให้ตรงก่อน apply ครั้งถัดไป
imagePullPolicy: IfNotPresent เหมาะกับ tag ไม่เปลี่ยนความหมาย; งานจริงใช้ digest ได้

## E. Rollback

```bash
kubectl -n lab rollout undo deployment/demo-api
kubectl -n lab rollout status deployment/demo-api --timeout=180s
```

แก้ image/env ในไฟล์ Git กลับเป็นเวอร์ชันที่ทำงานได้ด้วย ไม่เช่นนั้น apply รอบหน้าจะดันเวอร์ชันเสียอีก
rollout undo ไม่ย้อนฐานข้อมูลหรือข้อมูลใน Volume; migration ต้องมีแผนแยก

## F. Offline lab ทางเลือก

บนเครื่อง build:
```bash
docker buildx build --platform linux/amd64 -t k8s-lab-demo-api:1.0.0 --load examples/demo-api
docker save -o /tmp/demo-api.tar k8s-lab-demo-api:1.0.0
scp /tmp/demo-api.tar labadmin@192.0.2.10:/tmp/demo-api.tar
```

บน Server:
```bash
sudo ctr -n k8s.io images import /tmp/demo-api.tar
sudo crictl --runtime-endpoint unix:///run/containerd/containerd.sock images
```

ตั้ง image ให้ตรงชื่อที่แสดงและ imagePullPolicy: Never สำหรับแล็บ offline
หากเพิ่ม Node ต้อง import ทุก Node; registry จัดการง่ายกว่าเมื่อขยายระบบ
