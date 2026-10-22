# 01 — เตรียม Linux ใหม่เท่านั้น

> ฉบับ public: IP `192.0.2.10`, hostname `lab-control-plane` และ user `labadmin` เป็นค่าตัวอย่าง ไม่ใช่ข้อมูลเครื่องจริง ต้องแทนด้วยค่าของคุณก่อนรันคำสั่ง (192.0.2.0/24 เป็น TEST-NET สำหรับเอกสาร)

เครื่องปัจจุบันทำผ่านแล้ว ไม่ต้องติดตั้ง runtime ซ้ำหรือเขียนทับ config ของ containerd ที่ใช้งานอยู่
คู่มือนี้สรุปการเตรียม Ubuntu; ชุดเวอร์ชันอ้างอิงใน repo ใช้ 26.04 LTS; ตรวจ compatibility ก่อนเลือก OS อื่น

## ตรวจและตั้งค่าพื้นฐาน

```bash
hostname -I
ip -br addr
ip route show default
sudo hostnamectl set-hostname lab-control-plane
sudo timedatectl set-timezone Asia/Bangkok
sudo timedatectl set-ntp true
timedatectl status
sudo nano /etc/hosts
```

ใส่ `192.0.2.10 lab-control-plane` และลบ mapping IP ตัวอย่างเก่าที่ขัดกัน เก็บ localhost ไว้
ตั้ง hostname เพียงชื่อเดียวต่อเครื่อง อย่ารันคำสั่งตั้งชื่อ Worker ทั้งหมดบน Host เดียว

## Swap

```bash
sudo swapoff -a
sudo cp /etc/fstab /etc/fstab.before-k8s
sudo sed -i '/^[^#].*[[:space:]]swap[[:space:]]/s/^/#/' /etc/fstab
swapon --show
```

ผลว่าง = swap ไม่เปิด; ตรวจซ้ำหลัง reboot และปิด zram/systemd swap unit ถ้ามี

## Kernel และ forwarding

```bash
sudo tee /etc/modules-load.d/k8s.conf >/dev/null <<'EOF'
overlay
br_netfilter
EOF
sudo modprobe overlay
sudo modprobe br_netfilter
sudo tee /etc/sysctl.d/99-kubernetes.conf >/dev/null <<'EOF'
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward = 1
EOF
sudo sysctl --system
```

## containerd

ทำเฉพาะเครื่องใหม่ที่ยังไม่มี runtime:
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gpg containerd
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml >/dev/null
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
grep -n SystemdCgroup /etc/containerd/config.toml
sudo systemctl enable --now containerd
sudo systemctl restart containerd
```

ต้องได้ SystemdCgroup=true และไม่มีการ disable CRI plugin
ใช้ config default จาก binary รุ่นที่ติดตั้งจริง เพราะ config containerd 1.x/2.x ต่างกัน

## Kubernetes packages

```bash
sudo mkdir -p -m 755 /etc/apt/keyrings
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.35/deb/Release.key |
  sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.35/deb/ /' |
  sudo tee /etc/apt/sources.list.d/kubernetes.list
sudo apt-get update
apt-cache madison kubeadm
```

เลือก package version ของ 1.35.9 ที่มีอยู่จริง เช่น 1.35.9-1.1 แล้วใช้ให้ตรงทั้งสาม package:

```bash
K8S_PACKAGE_VERSION=1.35.9-1.1
sudo apt-get install -y kubelet="$K8S_PACKAGE_VERSION" kubeadm="$K8S_PACKAGE_VERSION" kubectl="$K8S_PACKAGE_VERSION" cri-tools
sudo apt-mark hold kubelet kubeadm kubectl
sudo systemctl enable kubelet
```

หาก version ไม่มีใน repository อย่าสลับ minor โดยอัตโนมัติ ให้ทบทวน compatibility และ config ก่อน
kubelet อาจ restart จนกว่าจะ init สำเร็จ

## Firewall

อย่า flush iptables/nftables เพราะ Docker/VM/Calico ใช้ร่วมกัน
ไม่เปิด API 6443 หรือ Headlamp สู่ Internet
Calico อาจขัดกับ UFW/firewalld; หากใช้ private lab ที่มี firewall ภายนอกจึงพิจารณาปิด host firewall manager
multi-node ในอนาคตต้องอนุญาต UDP 4789 (VXLAN), TCP 5473 (Typha), API 6443 และ kubelet 10250 ระหว่างผู้เกี่ยวข้อง
