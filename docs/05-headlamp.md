# 05 — Headlamp UI ผ่าน Docker (optional)

> ฉบับ public: IP `192.0.2.10`, hostname `lab-control-plane` และ user `labadmin` เป็นค่าตัวอย่าง ไม่ใช่ข้อมูลเครื่องจริง ต้องแทนด้วยค่าของคุณก่อนรันคำสั่ง (192.0.2.0/24 เป็น TEST-NET สำหรับเอกสาร)

Headlamp เป็น Apache-2.0 open source รันเป็น Desktop, Docker หรือใน Kubernetes ได้
บทนี้ใช้ Docker Engine บน Linux แยกจาก containerd ของ Kubernetes
ยังไม่มีผลยืนยันการติดตั้ง Headlamp บนเครื่องจริงจากบทสนทนา

## ตรวจ Docker ก่อน

```bash
sudo docker version
sudo docker compose version
```

ต้องมี Client+Server และ Compose plugin; การมี containerd ไม่ได้แปลว่ามี Docker
หากไม่มี Docker ดู https://docs.docker.com/engine/install/ubuntu/ และประเมิน package conflict ก่อน
อย่า uninstall containerd/runc ที่ cluster ใช้อยู่เพื่อให้ Docker ลงได้; ใช้ Headlamp Desktop บน Mac แทนได้

## รัน Compose

```bash
cd docker/headlamp
cp .env.example .env
# แก้ path ให้ตรงผู้ใช้จริง และเลือก release tag/digest เมื่อจะใช้ระยะยาว
sudo docker compose config
sudo docker compose up -d
sudo docker compose logs --tail=80
```

ถ้ามี container ชื่อ headlamp จาก docker run เดิมอยู่แล้ว ให้เลือกวิธีเดียว ไม่สร้างซ้ำ
Compose ใช้ root ภายใน container เพื่ออ่านไฟล์ permission 600 แต่ไม่ privileged และไม่ mount Docker socket
kubeconfig นี้มีสิทธิ์ admin; read-only mount ไม่ได้ทำให้ Kubernetes credentials เป็น read-only

## จาก Mac

```bash
ssh -N -L 4466:127.0.0.1:4466 labadmin@192.0.2.10
```

เปิด http://localhost:4466 แล้วเลือก Workloads → Pods → namespace lab
ไม่เปิด UI ที่ใช้ admin credentials บน 0.0.0.0 หรือ Internet
ไฟล์ .env / kubeconfig ไม่ commit ลง Git

## หยุด / ดู image digest

```bash
sudo docker compose stop
sudo docker image inspect ghcr.io/headlamp-k8s/headlamp:latest --format '{{json .RepoDigests}}'
```

นำ digest ที่ตรวจแล้วไปกำหนด HEADLAMP_IMAGE ใน .env เพื่อทำซ้ำได้
