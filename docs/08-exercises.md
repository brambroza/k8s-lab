# 08 — แบบฝึก single-node

> ฉบับ public: IP `192.0.2.10`, hostname `lab-control-plane` และ user `labadmin` เป็นค่าตัวอย่าง ไม่ใช่ข้อมูลเครื่องจริง ต้องแทนด้วยค่าของคุณก่อนรันคำสั่ง (192.0.2.0/24 เป็น TEST-NET สำหรับเอกสาร)

## Self-healing
```bash
kubectl -n lab get pods -l app=podinfo
POD_NAME=$(kubectl -n lab get pods -l app=podinfo -o jsonpath='{.items[0].metadata.name}')
kubectl -n lab delete pod "$POD_NAME"
kubectl -n lab get pods -w
```
ผ่านเมื่อกลับมา Ready 2 ตัว การ delete Pod โดยตรงไม่ถูก PDB ป้องกันเหมือน eviction

## Scale
```bash
kubectl -n lab scale deployment/podinfo --replicas=3
kubectl -n lab rollout status deployment/podinfo
kubectl -n lab scale deployment/podinfo --replicas=2
```
ดู RAM/CPU ของ Host ก่อนเพิ่ม; kubectl top ต้องติดตั้ง Metrics Server เพิ่ม ยังไม่อยู่ในชุดนี้

## Image ผิดแล้ว rollback
```bash
kubectl -n lab set image deployment/podinfo podinfo=ghcr.io/stefanprodan/podinfo:does-not-exist
kubectl -n lab get pods
kubectl -n lab get events --sort-by=.metadata.creationTimestamp
kubectl -n lab rollout undo deployment/podinfo
kubectl -n lab rollout status deployment/podinfo --timeout=180s
```
maxUnavailable=0 ช่วยเก็บรุ่นเดิมขณะรุ่นใหม่ล้ม แต่ไม่ได้รับประกัน zero downtime ทุกสาเหตุ

## NetworkPolicy
```bash
kubectl apply -f manifests/apps/client.yaml
kubectl -n lab wait --for=condition=Ready pod/client --timeout=120s
kubectl -n lab exec client -- wget -T 3 -qO- http://podinfo
kubectl apply -f manifests/policies/podinfo-deny.yaml
kubectl -n lab exec client -- wget -T 3 -qO- http://podinfo
```
ครั้งหลังควร timeout; policy ใช้ incoming traffic ของ Podinfo เท่านั้น

```bash
kubectl apply -f manifests/policies/podinfo-allow.yaml
kubectl -n lab exec client -- wget -T 3 -qO- http://podinfo
kubectl -n lab label pod client role-
kubectl -n lab exec client -- wget -T 3 -qO- http://podinfo
kubectl -n lab label pod client role=tester
```
allow เรียกได้ / เอา label ออกควรถูกบล็อก
policy deny/allow ใช้ชื่อเดียวกัน จึงสลับแทนกัน ไม่ใช่ deny ที่ override allow policies อื่น
หากมี NetworkPolicy อื่นอนุญาต traffic อยู่ ผลอาจไม่ถูกบล็อกเพราะ policies รวมสิทธิ์กัน
client นอน 24 ชั่วโมง; ถ้าหมดอายุให้ delete แล้ว apply ใหม่

## สิ่งที่ยังไม่ควรทดสอบบนเครื่องเดียว

- drain เพื่อย้ายไป Node อื่น (ไม่มีปลายทาง)
- ทดสอบเครื่องดับแล้วหวังให้บริการต่อ (ทุกอย่างอยู่เครื่องเดียว)
- etcd restore โดยไม่ backup และไม่มีแผนทดสอบแยก

ต่อยอด: Metrics Server/HPA → monitoring → RBAC → backup/restore → multi-node
