---
title: "Tutorial 1: Setting up QEMU and Libvirt for Kernel Development"
description: "My impressions on the FLUSP tutorial 'Setting up a test environment for Linux Kernel Dev using QEMU and libvirt'"
date: 2026-02-25
---

> Following FLUSP tutorial ["Setting up a test environment for Linux Kernel Dev using QEMU and libvirt"](https://flusp.ime.usp.br/kernel/qemu-libvirt-setup/)

This tutorial covers setting up QEMU and libvirt to compile and test the Linux kernel inside a Virtual Machine. Although the official tutorial is comprehensive and easy to follow, I had to tweak some settings to get everything working smoothly on my Manjaro Linux laptop.

> **💡 Quick Update:** When downloading the VM image, the URL provided in the original tutorial is no longer active (as of early March). The best approach is to go to the Debian Cloud Images repository and choose the appropriate `.qcow2` image from a recent version.

### Command Adjustments for Manjaro (and Arch-based distros)

When trying to run the VM with `virsh`, I immediately hit a permission issue when the system tried to access the `.qcow2` file. After doing some digging, I realized this happens because libvirt often defaults to the wrong user when running under `sudo`.

The best solution I found was to simply not use `sudo` for these commands.

Instead, the `create_vm_virsh` script should call `virt-install` in user mode. To achieve this, I used the `--connect qemu:///session` flag, which ensures the VM runs with your standard user permissions.

Additionally, to communicate with the VM, I used the following arguments:

```bash
--qemu-commandline="-netdev user,id=net0,hostfwd=tcp::2222-:22" \
--qemu-commandline="-device virtio-net-device,netdev=net0"
```

This forwards port 2222 on the host machine to port 22 inside the VM, enabling easy SSH communication.

### Finalizing the SSH Setup

Upon first launching the VM via the QEMU console, I had to install the SSH server manually:

```bash
sudo apt update
sudo apt install openssh-server
```

After modifying the VM's SSH config file (`/etc/ssh/sshd_config`) as recommended in the tutorial to allow root login, I was successfully able to connect to the machine from my host terminal:

```bash
ssh -p 2222 root@127.0.0.1
```

And send files back and forth using `scp`:

```bash
scp -P 2222 ~/teste.txt root@127.0.0.1:/root/foo
```