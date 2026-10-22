# Kubernetes Lab — Single Linux Node

คู่มือภาษาไทยและ manifests สรุปแล็บ Kubernetes เครื่องเดียว ทำหน้าที่ทั้ง Control Plane และ Worker

**ฉบับ public ไม่มี IP, hostname, username หรือ credentials ของเครื่องจริง** ค่าที่ใช้ในคำสั่งเป็นตัวอย่าง ต้องปรับก่อนรัน โดยเฉพาะ config/kubeadm-init.yaml และ SSH commands

หาก Cluster เดิม Ready อยู่แล้ว ใช้ชื่อ Node จริงจาก `kubectl get nodes` และข้ามขั้น init / runtime installation

## สรุปขั้นตอนที่ทำและชุดเวอร์ชันอ้างอิง

| ส่วน | สถานะ |
|---|---|
| Control Plane | ผ่านการตรวจ Ready ในแล็บ |
| ชุดอ้างอิงสำหรับทำซ้ำ | Ubuntu 26.04 LTS |
| Kubernetes v1.35.9 / containerd 2.2.2 | ใช้งานแล้ว |
| Calico 3.33.0 / Tigera Operator 1.44.0 | Available, ไม่ Degraded |
| CoreDNS | Running |
| MutatingAdmissionPolicy API v1beta1 | เปิดสำเร็จ |
| Control-plane NoSchedule taint | นำออกแล้วสำหรับ single-node lab |
| Podinfo port-forward | ยืนยันว่าคำสั่งเปิด port ได้ ยังไม่มีผล browser test |
| Headlamp / Gateway / แอป demo ใน repo | คู่มือและตัวอย่างเพิ่มเติม ยังไม่ได้ทดสอบบน Server จริง |

**เครื่องเดียวไม่ใช่ HA**: 2 replicas ช่วยระดับ Pod แต่เครื่องดับแล้วทุก Pod และ Control Plane หยุดพร้อมกัน
ไม่ต้องทำ `kubeadm join` กับเครื่องเดิม และไม่ต้อง init/reset Cluster ที่ Ready อยู่แล้ว

## ใช้งาน repository

```bash
git clone https://github.com/brambroza/k8s-lab.git
cd k8s-lab
kubectl get nodes -o wide
kubectl get pods -A
kubectl apply -f manifests/apps/podinfo.yaml
kubectl -n lab rollout status deployment/podinfo --timeout=180s
```

## ลำดับบทเรียน

| ขั้น | คู่มือ | เมื่อไรต้องทำ |
|---|---|---|
| 00 | [ภาพรวมและพอร์ต](docs/00-architecture.md) | อ่านก่อน |
| 01 | [Linux, เวลาไทย, swap, containerd, packages](docs/01-linux.md) | เครื่องใหม่เท่านั้น |
| 02 | [kubeadm และ single-node](docs/02-cluster.md) | เครื่องใหม่; มีส่วนเก็บ config สำหรับ cluster เดิม |
| 03 | [Calico และ MAP](docs/03-calico.md) | เครื่องใหม่; cluster ปัจจุบันผ่านแล้ว |
| 04 | [Podinfo และ SSH tunnel](docs/04-podinfo.md) | ใช้ทดสอบ |
| 05 | [Headlamp ผ่าน Docker](docs/05-headlamp.md) | ทางเลือกสำหรับ UI |
| 06 | [Gateway, hostname, HTTPS](docs/06-gateway.md) | ทางเลือกสำหรับรับ HTTP เข้าแอป |
| 07 | [Image ใหม่ / แอปใหม่ / rollback](docs/07-images.md) | งาน deploy ประจำ |
| 08 | [ซ้อม failure และ NetworkPolicy](docs/08-exercises.md) | เรียนรู้บน single-node |
| 09 | [Troubleshooting](docs/09-troubleshooting.md) | เมื่อมี error |

## โครงสร้าง

- `config/` — kubeadm configuration ไม่มี credentials
- `manifests/calico/` — Installation และ APIServer
- `manifests/apps/` — Podinfo, demo API และ client
- `manifests/gateway/` — GatewayClass, EnvoyProxy, Gateway และ routes
- `manifests/policies/` — NetworkPolicy (apply แยกอย่างตั้งใจ)
- `docker/headlamp/` — Compose สำหรับ UI
- `examples/demo-api/` — แอป Node.js ไม่มี dependencies สำหรับ build image เอง
- `scripts/` — ตรวจสุขภาพแบบ read-only
- `docs/` — ขั้นตอนและบทเรียนที่แก้จากปัญหาจริง

**อย่าใช้ `kubectl apply -R -f manifests/`**: มีทั้ง optional resources และ policy สำหรับฝึกปิดการเข้าถึง ให้ apply ตามคู่มือทีละส่วน

## ขอบเขตความปลอดภัย

Repository เป็น public: ไม่ใส่ kubeconfig, token, certificates, registry passwords หรือ Kubernetes Secret ที่มีค่าจริง
IP `192.0.2.10` เป็น TEST-NET สำหรับเอกสาร ไม่ใช่ IP เครื่องจริง ต้องเปลี่ยนก่อนใช้งาน เช่นเดียวกับ hostname `lab-control-plane` และ user `labadmin`
การเพิ่มไฟล์ใน Git ไม่ได้ deploy บน Server อัตโนมัติ และไม่มี workflow ที่เปลี่ยน cluster โดยอัตโนมัติ

## การตรวจสอบ

ไฟล์ถูกตรวจ syntax YAML/JavaScript/shell และ cross-reference ของ manifests ในสภาพแวดล้อมจัดทำเอกสาร
ไม่ได้รัน cluster หรือ Docker/Helm บนเครื่องผู้ใช้จาก repository นี้
ก่อนใช้งานจริง ให้ทำ server-side dry-run และ rollout checks ตามแต่ละบท
แหล่งอ้างอิงทางการอยู่ใน [sources](docs/sources.md)
