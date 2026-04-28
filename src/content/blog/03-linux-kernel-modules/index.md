---
title: "Introduction to Linux Kernel Modules"
description: "Creating and compiling Linux kernel modules, troubleshooting networking and architecture issues."
date: "Mar 17 2024"
---

In this tutorial, things broke, and I spent quite a bit of time going back and forth to fix them. Here's what I learned from the experience.

## Networking Conflicts

The first issue was a networking conflict. My previous adjustments to use port forwarding:

```bash
--netdev user,id=net0,hostfwd=tcp::2222-:22
```

were clashing with the `--network user` argument. Because the VM was trying to initialize two different networking backends, I was losing SSH access seemingly at random. Once I removed the conflicting bridge network flag, the connection stabilized.

## Kernel Module Compilation Issues

With the network fixed, I moved on to creating and compiling a new kernel module. However, after running `kw build` and booting the machine, it hung completely.

### The Architecture Problem

After some trial and error I discovered that when I ran `make -C "$IIO_TREE" menuconfig` (and potentially other kernel's make commands), the kernel's build system defaulted to my host machine's architecture (x86) and silently overwrote my entire `.config` file.

Since I was building for an ARM64 virtual machine, I needed to **explicitly pass the architecture flags** so make wouldn't break my config:

```bash
make ARCH=arm64 -C "$IIO_TREE" menuconfig
```

## Key Lessons

This tutorial taught me the importance of:

1. **Isolating networking configurations** - don't stack multiple networking backends
2. **Explicit architecture specifications** - always set ARCH when cross-compiling
3. **Monitoring build output** - understand what's being compiled and where
4. **Testing configurations** - verify your kernel config stays intact after make commands

With these lessons learned, kernel module development becomes much more straightforward. The errors are usually signals pointing toward a misconfiguration rather than a deeper issue.
