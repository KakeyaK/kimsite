---
title: "Contributing to the Linux Kernel"
date: 2026-04-29
description: "A blog post about my experience contributing to the Linux Kernel"
---

Together with [Raffael Raiél ](https://rfflrt.github.io/) I've been contributing to refactoring IIO tree code by replacing old style mutex lock and unlock with the newer `guard()` macro. 

We started by looking a suitable file for the improvement. Using ripgrep we found that the file drivers/iio/light/vcnl4000.c had several uses of mutex lock and unlock. Moreover, it was a good fit for us since we were already used to dealing and compiling the iio tree. 

The modification work was swift. We had no issues in making the refactoring, and sent our [patch for correction](https://lore.kernel.org/linux-iio/20260416211651.9625-1-raffaelraiel@usp.br/) on 16th April. After some back and forth with style details we got a LGTM from Andy Shevchenko on 20th April. However, before merging, [Jonathan Cameron noted](https://lore.kernel.org/linux-iio/20260421154952.5784d2bb@jic23-huawei/) that we could expand our patch to also deal with issues on other code. That's where we are now. 

Until now the process is going fine. It's weird to contribute through mail lists instead of a tool like Github, but kw and git make things a little easier. Also, all the culture around specifics when sending patches is very new to me. 