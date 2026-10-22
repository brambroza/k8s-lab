# 03 — Calico 3.33 และ MutatingAdmissionPolicy

> ฉบับ public: IP `192.0.2.10`, hostname `lab-control-plane` และ user `labadmin` เป็นค่าตัวอย่าง ไม่ใช่ข้อมูลเครื่องจริง ต้องแทนด้วยค่าของคุณก่อนรันคำสั่ง (192.0.2.0/24 เป็น TEST-NET สำหรับเอกสาร)

เครื่องปัจจุบัน Calico Available แล้ว ไม่ต้องติดตั้งใหม่
ไฟล์ repo เพิ่มการเลือก NodeInternalIP อย่างชัดเจน เหมาะกับ Host ที่มี Docker/VM bridges หลายตัว

## ตรวจ prerequisite ก่อนติดตั้งใหม่

```bash
kubectl get --raw='/readyz'
kubectl api-resources --api-group=admissionregistration.k8s.io
```

ต้องมี mutatingadmissionpolicies และ mutatingadmissionpolicybindings
Kubernetes 1.35 ต้องเปิด feature gate + admissionregistration.k8s.io/v1beta1 ตาม config บท 02
ถ้าเห็นเฉพาะ mutatingwebhookconfigurations ยังไม่ผ่าน

## ติดตั้งตามลำดับ

```bash
kubectl apply --server-side -f https://raw.githubusercontent.com/projectcalico/calico/v3.33.0/manifests/v3_projectcalico_org-v1beta1.yaml
kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.33.0/manifests/tigera-operator.yaml
kubectl wait --for=condition=Established crd/installations.operator.tigera.io --timeout=120s
kubectl apply -f manifests/calico/installation.yaml
kubectl -n tigera-operator rollout status deployment/tigera-operator --timeout=180s
kubectl wait --for=condition=Ready node/lab-control-plane --timeout=300s
kubectl get pods -A
kubectl get tigerastatus
```

create Operator ใช้ครั้งแรกเท่านั้น; ถ้ามีอยู่แล้วตรวจ version/status ไม่ลบทิ้งเพื่อรันซ้ำ
server-side apply มี conflict ให้ตรวจ ownership ก่อน ไม่ force-conflicts อัตโนมัติ
ไม่มีการเปิด Goldmane/Whisker ในแล็บนี้เพื่อประหยัด RAM

## เหตุการณ์ที่พบจริง

Operator ขึ้น CrashLoopBackOff:
```text
v3present: true
mapServed: false
v3 CRD mode requires MutatingAdmissionPolicy support
```
Node ขึ้น cni plugin not initialized เพราะ Operator ยังสร้าง CNI ไม่สำเร็จ
แก้ API prerequisites แล้ว apply CRDs/policies ซ้ำ และ restart Operator:
```bash
kubectl -n tigera-operator rollout restart deployment/tigera-operator
```
ไม่ต้อง reset Cluster หรือเปลี่ยน Pod CIDR
