---
title: "Building a Custom Linux Kernel with kw"
description: "Understanding kernel compilation workflows and using kw to build and deploy custom kernels."
date: "Mar 16 2024"
---

It took me some time, but eventually, this tutorial clicked into place and I got a better understanding of how things were related.

## Installing kw (Kernel Workflow)

First things first: installing kw. During the installation, I had to make a small adjustment to the dependency tracker. In `kw/documentation/dependencies/arch.dependencies`, I updated the script to recognize `pipewire-pulse` as a valid dependency instead of `pulseaudio`, since Pipewire is the default on my Manjaro system.

Once kw was installed, I needed to adjust the kw remote command to play nicely with the custom port forwarding network tweak I set up in the previous tutorial:

```bash
kw remote --add arm64 root@127.0.0.1:2222 --set-default
```

**Note:** I also had to run `sudo apt install rsync` inside the VM, as kw relies on it for fast file transfers.

## Booting the VM

I spent some hours trying to get my newly compiled kernel to actually boot on my VM. Initially, it would just hang without sending any information to the console. I don't quite get what happened, but I decided to redo the steps from this tutorial from scratch and eventually things started to work.

On this second run, things started to make more sense and I think I got a better understanding of the overall compilation architecture. The hardest part for me was connecting the dots between:

- What the `.config` file does
- What is actually being compiled when you run `kw build`
- The difference between what gets compiled as a loadable `.ko` module vs. what gets baked directly into the main Kernel Image

## Key Learnings

The kernel build process is more nuanced than it initially appears. Understanding the relationship between configuration files, build targets, and module compilation is crucial for effective kernel development. Take your time working through these concepts—it'll pay off in the long run.
