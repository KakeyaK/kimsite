---
title: "Tutorial 4: Writing a Linux Character Device Driver"
date: 2026-03-18
description: "My impressions on the FLUSP tutorial 'Introduction to Linux kernel Character Device Drivers'"
---

> Following FLUSP tutorial ["Introduction to Linux kernel Character Device Drivers"](https://flusp.ime.usp.br/kernel/char-drivers-intro/)

Tutorial 4 was smooth. After the hurdles of the previous sections, writing the C code for a kernel module was nice. I was able to successfully create the final driver, complete with the exercise requirements to support multiple connected devices and multiple independent memory buffers.

This is my final working code for a linux character device driver that dynamically allocates independent buffers based on the device's minor number:

```c
#define pr_fmt(fmt) KBUILD_MODNAME ": " fmt

#include <linux/init.h>
#include <linux/module.h>
#include <linux/kdev_t.h>  /* for MAJOR */
#include <linux/cdev.h>    /* for cdev */
#include <linux/fs.h>      /* for chrdev functions */
#include <linux/slab.h>    /* for kmalloc */
#include <linux/string.h>  /* for sprintf() */
#include <linux/uaccess.h> /* copy_to_user() and copy_from_user() */

#define S_BUFF_SIZE 4096
#define MINOR_NUMS 3

struct cdev *s_cdev;
static dev_t dev_id;

/* Array of pointers to hold a separate buffer for each minor device */
static char *s_buf[MINOR_NUMS];

static int simple_char_open(struct inode *inode, struct file *file)
{
    unsigned int minor_num = MINOR(inode->i_rdev);

    /* Security check: Make sure the user isn't trying to open an unsupported device */
    if (minor_num >= MINOR_NUMS) {
        pr_err("Invalid minor number %u\n", minor_num);
        return -ENODEV;
    }

    /* Allocate the buffer for this specific minor number if it doesn't exist yet */
    if (!s_buf[minor_num]) {
        s_buf[minor_num] = kmalloc(S_BUFF_SIZE, GFP_KERNEL);
        if (!s_buf[minor_num])
            return -ENOMEM;

        /* Give it a custom starting message */
        sprintf(s_buf[minor_num], "This is data from simple_char device %u.", minor_num);
        pr_info("Allocated new buffer for minor %u\n", minor_num);
    }

    pr_info("Opened device with Major: %u, Minor: %u\n", MAJOR(inode->i_rdev), minor_num);
    return 0;
}

static ssize_t simple_char_read(struct file *file, char __user *buffer,
                size_t count, loff_t *ppos)
{
    unsigned int minor_num = MINOR(file->f_inode->i_rdev);
    int n_bytes;

    if (minor_num >= MINOR_NUMS || !s_buf[minor_num])
        return -ENODEV;

    pr_info("Reading %zu bytes from minor %u\n", count, minor_num);

    n_bytes = count - copy_to_user(buffer, s_buf[minor_num] + *ppos, count);
    *ppos += n_bytes;
    
    return n_bytes;
}

static ssize_t simple_char_write(struct file *file, const char __user *buffer,
                 size_t count, loff_t *ppos)
{
    unsigned int minor_num = MINOR(file->f_inode->i_rdev);
    int n_bytes;

    if (minor_num >= MINOR_NUMS || !s_buf[minor_num])
        return -ENODEV;

    pr_info("Writing %zu bytes to minor %u\n", count, minor_num);

    n_bytes = count - copy_from_user(s_buf[minor_num] + *ppos, buffer, count);
    *ppos += n_bytes; /* Advance the file position after writing */
    
    return n_bytes;
}

static int simple_char_release(struct inode *inode, struct file *file)
{
    pr_info("Closed device\n");
    return 0;
}

static const struct file_operations simple_char_fops = {
    .owner = THIS_MODULE,
    .open = simple_char_open,
    .release = simple_char_release,
    .read = simple_char_read,
    .write = simple_char_write,
};

static int __init simple_char_init(void)
{
    int ret;

    pr_info("Initializing module.\n");

    /* Dynamically allocate character device numbers. */
    ret = alloc_chrdev_region(&dev_id, 0, MINOR_NUMS, "simple_char");
    if (ret < 0)
        return ret;

    /* Allocate and initialize the character device cdev structure */
    s_cdev = cdev_alloc();
    s_cdev->ops = &simple_char_fops;
    s_cdev->owner = simple_char_fops.owner;

    /* Adds a mapping for the device ID into the system. */
    return cdev_add(s_cdev, dev_id, MINOR_NUMS);
}

static void __exit simple_char_exit(void)
{
    int i;

    cdev_del(s_cdev);
    unregister_chrdev_region(dev_id, MINOR_NUMS);

    /* Free any buffers that were allocated during the driver's lifetime */
    for (i = 0; i < MINOR_NUMS; i++) {
        if (s_buf[i]) {
            kfree(s_buf[i]);
            pr_info("Freed buffer for minor %d\n", i);
        }
    }

    pr_info("Exiting module.\n");
}

module_init(simple_char_init);
module_exit(simple_char_exit);

MODULE_AUTHOR("A Linux kernel student");
MODULE_DESCRIPTION("A simple character device driver example.");
MODULE_LICENSE("GPL");
```