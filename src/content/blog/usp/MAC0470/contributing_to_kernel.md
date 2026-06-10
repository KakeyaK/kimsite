---
title: "Contributing to the Linux Kernel"
date: 2026-04-29
description: "A blog post about my experience contributing to the Linux Kernel"
---

Together with [Raffael Raiél ](https://rfflrt.github.io/) I contributed to refactoring IIO tree code by replacing old style mutex lock and unlock with the newer `guard()` macro. 

We started by searching a suitable file for improvement. Using ripgrep we found that the file `drivers/iio/light/vcnl4000.c` had several uses of mutex lock and unlock. Moreover, it was a good fit for us since we were already used to working with the iio tree. 

The initial modification work was swift. We had no issues in making the refactoring, and sent our [first patch for correction](https://lore.kernel.org/linux-iio/20260416211651.9625-1-raffaelraiel@usp.br/) on 16th April. After some back and forth with style details ([Patch v2](https://lore.kernel.org/linux-iio/20260420180454.90611-1-raffaelraiel@usp.br/), simplifying return paths and attributions and [Patch v3](https://lore.kernel.org/linux-iio/20260420200047.102159-1-raffaelraiel@usp.br/) fixing indentation) we got a LGTM from Andy Shevchenko on 20th April. 

<figure>
  <img src="/documents/blog/usp/MAC0470/LGTM_Andy.png" alt="Accepted patch" />
  <figcaption>LGTM from Andy Shevchenko</figcaption>
</figure>


However, before merging, [Jonathan Cameron noted](https://lore.kernel.org/linux-iio/20260421154952.5784d2bb@jic23-huawei/) that we could expand our patch to also deal with issues on other code. We then expanded the code with [Patch v4](https://lore.kernel.org/linux-iio/20260506210616.313636-1-raffaelraiel@usp.br/). Again, the code needed some small refinements, which led to [Patch v5](https://lore.kernel.org/linux-iio/20260512184728.298680-1-raffaelraiel@usp.br/) (simplifying return commands) and finally [Patch v6](https://lore.kernel.org/linux-iio/20260515152414.5c8dfebb@jic23-huawei/) (Removing unnecessary conditionals). 

With Patch v6, we [finally got accepted](https://lore.kernel.org/linux-iio/20260515152414.5c8dfebb@jic23-huawei/)! 🥳🎉🎊

<figure>
  <img src="/documents/blog/usp/MAC0470/accepted_patch.png" alt="Accepted patch" />
  <figcaption>Approval message from Jonathan Cameron</figcaption>
</figure>

At first, it was weird to contribute through mail lists instead of a tool like Github, but kw and git made things a little easier. The culture specificities around sending patches, versioning, etc was also new to me. In the beginning, it all felt a little weird, but with time it all clicked, and the patches got easier and easier to make.

---

Our complete commit history and feedback received can be find in [this lore link](https://lore.kernel.org/linux-iio/?q=iio%3A+light%3A+vcnl4000%3A+use+lock+guard%28%29).