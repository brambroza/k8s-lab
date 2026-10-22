# 04 — Deploy Podinfo และเปิดหน้าเว็บ

> ฉบับ public: IP `192.0.2.10`, hostname `lab-control-plane` และ user `labadmin` เป็นค่าตัวอย่าง ไม่ใช่ข้อมูลเครื่องจริง ต้องแทนด้วยค่าของคุณก่อนรันคำสั่ง (192.0.2.0/24 เป็น TEST-NET สำหรับเอกสาร)

รันจาก root ของ repo บน Server:
```bash
kubectl apply -f manifests/apps/podinfo.yaml
kubectl -n lab rollout status deployment/podinfo --timeout=180s
kubectl -n lab get pods -o wide
kubectl -n lab get svc
```

สอง replicas อยู่เครื่องเดียว ไม่ใช่ HA ระดับเครื่อง
manifest ใช้ non-root, restricted Pod Security, read-only root filesystem, probes, resources และ PDB

## Terminal บน Linux (เปิดค้างไว้)

```bash
kubectl -n lab port-forward service/podinfo 8080:80
```

## Terminal บน Mac (เปิดค้างไว้)

```bash
ssh -N -L 9090:127.0.0.1:8080 labadmin@192.0.2.10
```

เปิด http://localhost:9090
-N ทำให้ SSH เงียบตามปกติ; 9090 คือพอร์ต Mac ส่วน 8080 คือ port-forward บน Server
ถ้า Mac 9090 ถูกใช้ เปลี่ยนเลขหน้าสุดเท่านั้น
ไม่จำเป็นต้องเปิด port-forward ด้วย --address=0.0.0.0

port-forward ผูกกับ Pod หนึ่งตัว ไม่ใช่การทดสอบ Service load balancing/failover
ถ้า Pod ถูกเปลี่ยนหรือลบ ให้เริ่ม port-forward ใหม่

## ตรวจ Service จากใน Cluster

```bash
kubectl apply -f manifests/apps/client.yaml
kubectl -n lab wait --for=condition=Ready pod/client --timeout=120s
kubectl -n lab exec client -- nslookup podinfo.lab.svc.cluster.local
kubectl -n lab exec client -- wget -T 3 -qO- http://podinfo
```
