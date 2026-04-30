---
title: "Tutorial 3: Introduction to Linux Kernel Modules"
date: 2026-03-11
description: "My impressions on the FLUSP tutorial 'Introduction to Linux kernel build configuration and modules'"
---

> Following FLUSP tutorial ["Introduction to Linux kernel build configuration and modules"](https://flusp.ime.usp.br/kernel/modules-intro/)

In tutorial 3, things broke, and I spent quite a bit of time going back and forth to fix them.

The first issue was a networking conflict. My previous adjustments to use port forwarding (`--netdev user,id=net0,hostfwd=tcp::2222-:22`) were clashing with the `--network user` argument. Because the VM was trying to initialize two different networking backends, I was losing SSH access seemingly at random. Once I removed the conflicting bridge network flag, the connection stabilized.

With the network fixed, I moved on to creating and compiling a new kernel module. However, after running `kw build` and booting the machine, it hung completely.

After some trial and error I discovered that when I ran `make -C "$IIO_TREE" menuconfig` (and potentially other kernel’s make commands), the kernel's build system defaulted to my host machine's architecture (x86) and silently overwrote my entire `.config` file. Because I was building for an ARM64 virtual machine, I needed to explicitly pass the architecture flags so make wouldn't break my config.

To fix this, I started running the command with `ARCH` and `CROSS_COMPILE` flags, as the following: 

```bash
make -C "$IIO_TREE" ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu- menuconfig
```

### A Quick Fix for the Offline Mount Script

One final observation: there is a small bug in the tutorial section where you use `guestmount` to inject modules into the VM while it is powered off. The unmount command references a variable that is never declared.

Here is the corrected snippet:

```bash
mkdir -p "${VM_DIR}/arm64_rootfs"

# Mount the VM rootfs to the given mount point
sudo guestmount --rw --add "${VM_DIR}/arm64_img.qcow2" --mount /dev/sda1 "${VM_DIR}/arm64_rootfs" 

# Install modules inside the VM
sudo --preserve-env make -C "${IIO_TREE}" ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu- INSTALL_MOD_PATH="${VM_DIR}/arm64_rootfs" modules_install 

# Unmount the VM using the correct path variable
sudo guestunmount "${VM_DIR}/arm64_rootfs" 
```

### Conclusions

After completing this tutorial and the exercises, the complete flow of building modules, sending them to the VM, and dynamically loading them into memory finally became clear. It is a very cool process once you get the hang of it!