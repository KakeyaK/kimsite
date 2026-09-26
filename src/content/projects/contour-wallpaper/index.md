---
title: "Contour Live Wallpaper"
description: "An Android live wallpaper with contour lines whose colors change throughout the day."
date: "Jul 13 2026"
repoURL: "https://github.com/KakeyaK/contour-wallpaper-app"
---

Contour is an Android live wallpaper that draws topographic contour lines over a color gradient. The colors shift slowly over the day, so the wallpaper looks different at dawn, midday, dusk and night.

<figure>
  <img src="/documents/projects/contour-wallpaper/contour-app.jpg" alt="Contour settings screen, with a wallpaper preview, a time slider, and a list of daily color anchors (dawn, morning, midday, afternoon, dusk)" />
  <figcaption>The settings screen, with the preview and daily color anchors</figcaption>
</figure>

## How it works

The app is written in Kotlin, and the settings UI uses plain Android Views. The wallpaper redraws once a minute and stops completely when it isn't visible.

The contour lines themselves aren't generated on the phone. A Python script (numpy and matplotlib) creates the terrain from a fixed seed and exports the lines as PNGs, and the app tints them with the current colors. There are two sets of images, one for narrow screens and one for wider ones, so the map lines up on both screens of a foldable.

## Installing

Every push runs a GitHub Actions workflow that builds a debug APK, which you can download from the Actions tab and install on your phone (you'll need to allow unknown sources). You can also build it yourself with `./gradlew assembleDebug`. The [README](https://github.com/KakeyaK/contour-wallpaper-app) has the details, including a script that builds it without the Android SDK, using only Ubuntu packages.

## Observation

This was an experimentation on creating a complete app from only claude.ai interface. I didn't actually code any of it, nor had read most of the code. The web agent generated the whole code, compiled it and sent me a .apk to test. After it was already working I decided to get the code and save it in Github, for future use. 
