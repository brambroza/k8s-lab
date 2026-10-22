# 02 — kubeadm และ single-node

> ฉบับ public: IP `192.0.2.10`, hostname `lab-control-plane` และ user `labadmin` เป็นค่าตัวอย่าง ไม่ใช่ข้อมูลเครื่องจริง ต้องแทนด้วยค่าของคุณก่อนรันคำสั่ง (192.0.2.0/24 เป็น TEST-NET สำหรับเอกสาร)

## สำหรับเครื่องใหม่เท่านั้น

แก้ IP, node name และ Kubernetes version ใน config ให้ตรงเครื่อง ตรวจว่า CIDR ไม่ทับเครือข่ายอื่น:
```bash
sudo kubeadm config validate --config config/kubeadm-init.yaml
sudo kubeadm init --config config/kubeadm-init.yaml
```

รอข้อความ initialized successfully ก่อนทำต่อ:
```bash
mkdir -p "$HOME/.kube"
sudo cp /etc/kubernetes/admin.conf "$HOME/.kube/config"
sudo chown "$(id -u):$(id -g)" "$HOME/.kube/config"
chmod 600 "$HOME/.kube/config"
kubectl get --raw='/readyz'
kubectl get nodes -o wide
```

NotReady ก่อนติดตั้ง Calico เป็นสิ่งที่คาดได้ แต่ API ต้องตอบ ok
config นี้เปิด MutatingAdmissionPolicy ตั้งแต่ต้น จึงไม่ต้องแก้ static Pod ภายหลัง

## อนุญาต workload บน single-node (ทำครั้งเดียว)

```bash
kubectl taint nodes lab-control-plane node-role.kubernetes.io/control-plane:NoSchedule-
kubectl get node lab-control-plane -o jsonpath='{.spec.taints}'; echo
```

ถ้า taint ไม่มีแล้ว ไม่ต้องทำซ้ำ ไม่ต้อง join เครื่องตัวเอง
workload และ control plane แบ่ง CPU/RAM เดียวกัน ต้องกำหนด requests/limits

## Cluster เดิม: เก็บ flags ให้คงอยู่ตอน upgrade

เครื่องที่ซ่อมผ่านการแก้ /etc/kubernetes/manifests/kube-apiserver.yaml ต้องบันทึกใน kubeadm ConfigMap ด้วย:
```bash
kubectl -n kube-system edit configmap kubeadm-config
```

ภายใน data.ClusterConfiguration (เป็น YAML string) merge ใต้ apiServer โดยเก็บค่าที่มีทั้งหมด:
```yaml
apiServer:
  extraArgs:
    - name: feature-gates
      value: MutatingAdmissionPolicy=true
    - name: runtime-config
      value: admissionregistration.k8s.io/v1beta1=true
```

ถ้ามี flag เดิมให้ merge ไม่ทำ key/flag ซ้ำ การแก้ ConfigMap ไม่ restart API server ทันที
ก่อน upgrade minor ต้องทบทวน flags และ compatibility ใหม่ ไม่ถือว่า config 1.35 ใช้ทุกเวอร์ชันได้

## การเพิ่ม Worker ในอนาคต

ต้องเป็น OS instance อื่น เตรียม runtime/packages และชื่อไม่ซ้ำ:
```bash
# Control Plane
kubeadm token create --print-join-command
```
นำคำสั่งจริงไป sudo รันบน Worker ห้าม commit token ลง Git
