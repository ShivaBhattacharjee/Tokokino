---
title: "Tokokino explained: features, use cases, and how it compares"
excerpt: "A detailed guide to Tokokino: screenshot and video tools, frames, backgrounds, animation, practical use cases, and choosing it alongside other editors."
date: 2026-09-07
authors:
  - Shiva Bhattacharjee
category: Getting started
cover: https://assets.tokokino.com/screenshot-v2.webp
---

## Why I built Tokokino

I needed a better way to present the things I was building. Screenshots, product updates, and short demos all needed some work before I could share them. I wanted to give them a consistent look without turning each one into a separate design project.

The alternatives fell short for the way I wanted to work. I wanted screenshot styling, device frames, and motion together, with enough control to make the result my own. For my workflow, the existing options were an inferior fit. That frustration became the reason to build Tokokino.

I built it as a free, open-source solution. The editor and its export options are currently free, and the code is available under AGPL-3.0. You can inspect it, self-host it, or contribute through the [source repository](https://git.new/Tokokino). Editing and encoding run in your browser, with online features for things like captures, cloud drafts, and sharing.

This guide explains what I have built so far, what you can do with it, and how the individual features fit together. Later, I compare the workflows with other tools so you can decide whether Tokokino addresses the same needs for you.

## What is Tokokino?

Tokokino is a browser-based editor for screenshots, device mockups, and short product videos. You bring the content: a screen from your app, a website capture, a social post, or a recording. Tokokino gives you the tools to frame it, arrange it, explain it, animate it, and export it.

I built these tools around a common job: showing software to someone who has not used it yet. A launch image needs to establish what the product looks like. A release note needs to point out a change. A demo needs to show how one step leads to another. Each starts with similar source material, but needs a different presentation.

The editor brings those jobs into one canvas. You can make a simple annotated screenshot, a layered composition with several devices, or an animated close-up of a feature. The framing, backgrounds, text, and styling you use for a still can also be used around video.

## What can you make with it?

### Product launches and landing pages

Put your main product screen inside a browser or device frame, choose a background that fits your site, and add a headline or supporting image. If you need to show both desktop and mobile, place the screens together. Use a still for the overview and a short animated version to move closer to a particular feature.

### Release notes and feature announcements

Start with the part of the interface that changed. Crop it, leave room for a label, and add an arrow where the reader should look. For a larger redesign, arrange the old and new screens on one canvas. Save the styling as a preset so next month's update belongs to the same series.

### Tutorials and support explanations

A screenshot with one clearly marked control can answer a question without a long walkthrough. Add text and annotations to explain where to click. When timing matters, import a recording and trim it to the relevant action. Keep the surrounding design quiet so the instructions are easy to follow.

### Portfolios and client presentations

Use device frames to present an interface in context, or leave the screen unframed when the design itself should take up more room. Multiple canvases let you prepare a set of views. Preview them as a sequence when you want to discuss a flow rather than one isolated screen.

### Social posts and customer quotes

Bring in an X or Bluesky post from its link and style the resulting card. This is useful for sharing an announcement, a conversation, or customer feedback with a consistent background and layout. You can also make a product image specifically for a social format by changing the canvas aspect ratio and arranging the content for that space.

## Bring in screenshots, websites, posts, or video

You can upload or paste an image to begin. Crop the capture to the area you need, then adjust its size and position within the canvas. The source image and the composition are separate concerns: changing the space around a screenshot does not mean you need to prepare a new file in another editor.

Website capture lets you start from a URL. It is useful when you want to present a public page without manually taking and importing a screenshot. Social post import handles X and Bluesky links as post cards, with controls for their appearance. These capture and fetch features use online services.

Video and GIF imports give you moving content to work with. A recording can occupy the same place on the canvas as a still screenshot, including inside a device frame. This lets you prepare a static product image and a recording with a similar visual treatment.

## Frames, layout, and perspective

### Device and browser frames

Device frames place your content inside phone, tablet, laptop, and desktop mockups. Choose the available colour and orientation for the device, then adjust how the screen sits in the composition. A phone mockup is useful for showing a mobile interface at a glance; a laptop gives a desktop product a familiar setting.

Browser frames include Safari, Chrome, and Arc styles, with light and dark appearances and an editable address. They work well for websites and web apps where a hardware bezel would take up unnecessary space. You can also keep the screenshot bare.

### Glass Card, Cascade, and Crown

Glass frames use translucent panes around your screen. Glass Card keeps the treatment relatively simple. Cascade and Crown add offset panes to create a layered arrangement. The background shows through the frosted glass, so the frame and the backdrop become part of the same composition.

These frames are useful when you want depth without choosing a particular device. Try one over an image or ASCII backdrop, then adjust the spacing so the glass remains a supporting detail rather than hiding the product.

### Padding, borders, shadows, and tilt

Padding controls the breathing room around your content. Borders and corner radius define its edge. Shadows separate it from the background, with controls for their style, intensity, colour, and light direction. Position and scale let you decide how much of the canvas the product occupies.

Tilt rotates the framed content in three dimensions. A slight angle can help distinguish overlapping screens; a straight-on view keeps dense interface text easier to read. Layout presets provide starting arrangements for multiple screenshots, so you can show related views together without positioning every screen from scratch.

## Backgrounds, textures, and colour

### Choose the base background

Start with a solid colour, a gradient, or an image. The background library includes different visual styles, and you can use your own image or find one through Unsplash. Auto backgrounds use colours from your screenshot to create a related palette.

The background sets the overall tone, but it also affects readability. A busy screenshot often works well against a restrained background. A sparse interface gives you more room to experiment with texture or a stronger colour. Adjust the canvas padding together with the background so the product still has enough room.

### Patterns, overlays, lighting, and blur

Backdrop controls add patterns, overlay textures, lighting, and portrait blur treatments around the content. They serve different purposes: a pattern can give an otherwise empty area some structure, while a lighting effect can draw attention toward one side of the composition. Overlay textures add another visible surface treatment.

Use these controls selectively. If the point is to explain a small button, extra texture may make that harder. If you are making a large launch image, the same treatment can fill space around the device without adding more text.

### ASCII backgrounds

ASCII turns the background into a grid of characters. You can change the character set, resolution, opacity, and colour treatment, including using colours sampled from the background. Sets include standard characters, blocks, binary, dots, circles, and stars.

The texture comes from the background rather than rewriting the screenshot's interface as characters. That means your product can stay readable in front of it. Glass frames are a useful pairing because the glyphs remain visible through the surrounding panes. You can also include ASCII changes in an animation.

### Grade the screenshot separately

Effects and filters can target the backdrop or the screenshot. This distinction matters when you want to soften or recolour the setting while keeping the interface faithful to the original. You can also apply a colour treatment to the media itself, including video.

For a composition with several screens, target an individual screenshot or apply styling across them. Colour grading can become part of a keyframe animation too. Use it to transition between treatments, but keep colours accurate when they communicate information in the interface.

## Text, annotations, and supporting layers

Add text when the screenshot needs a headline, a label, or an explanation that is not already in the interface. Arrows, annotation shapes, and freehand marks let you point to a specific region. These elements remain editable, so you can move a label when the composition changes.

Images, stickers, and the built-in 3D shapes library provide supporting assets. Shapes behave like other image layers: you can position, resize, rotate, style, and reorder them. They are useful as part of a designed launch visual or section divider, rather than as a substitute for showing the actual product.

Layer order determines what sits in front. This becomes useful when you combine a frame, text, and additional images: a headline may need to sit above the composition, while a decorative asset belongs behind the main content. Build the hierarchy around what the viewer needs to understand first.

## Animate a screenshot with keyframes

Animate mode adds a timeline to the canvas. A keyframe describes a change to properties such as position, zoom, tilt, padding, shadow, background, lighting, borders, or colour treatment. Select a clip and edit the properties you want it to change, then scrub or play the timeline to see the transition.

For example, start with a full view of a dashboard. Add a keyframe that increases the zoom and shifts the screen toward the new chart. The result moves from an overview to a detail using the same screenshot. You can also change the background or shadow as part of the sequence when the presentation calls for it.

Easing controls how quickly a transition accelerates and settles. Choose a preset curve or adjust a custom curve with its handles. This is useful when a movement reaches the right destination but feels too abrupt. The timeline also indicates which effects a clip changes, helping you see what you are editing.

Animation is optional. For a support article, a single annotated frame might explain the feature more directly. Use the timeline when the movement, sequence, or change adds information.

## Style and trim a recording

Import a video or GIF when you already have a sequence to show. You can crop the visible content, scrub through it, mute the audio, and trim its timeline. An audio waveform on the video track helps you see where sound occurs while working with the recording.

The canvas styling still applies. Put the recording inside a browser frame, add a background, and place explanatory text around it. This is useful for a short feature demonstration where you want the actual interface interaction and a consistent presentation around it.

There are two different kinds of motion here: the recording contains its own action, while Animate mode changes the presentation around your media. Choose the controls that fit the job. Trimming removes time you do not need; a zoom keyframe changes what the viewer sees most prominently.

## Templates, presets, and sets of canvases

Templates are ready-made compositions you can use as a starting point. Some include animation. Replace the sample content with your own and adjust the layout, rather than assuming every detail of the template will fit your screenshot. The library includes glass and ASCII combinations if you want to explore those features together.

Layout presets help arrange screens, while custom presets let you reuse a style you have already put together. If you publish feature updates regularly, save your preferred framing and background so each new image does not start from a blank canvas.

Multiple canvases and bulk edit mode help you work on a set. You can arrange canvases in the workspace and use preview mode to look through them. A launch set might include an overview, a mobile view, and a detail image. Keeping them together makes it easier to notice inconsistent spacing or a background that does not fit the rest.

## Drafts, offline work, and sharing

Tokokino saves editor state locally as you work. You can return to the composition after a refresh instead of starting again. Signed-in users can also save cloud drafts and reopen them across devices, including projects containing animation and video.

Offline support keeps the editing workspace useful when your connection drops. Features that fetch new content, such as website capture, Unsplash, and cloud operations, still need a connection. Device frames and other remote assets also need to be available before you can rely on them offline.

A draft preserves the editable project. A share link publishes the finished output. When you are ready to send an image or video, sign in and use Share to create a public page. The shares gallery keeps your published links and view information together.

## Export a still image or motion file

Still exports support PNG, JPEG, and WebP, with HD, 4K, and 8K width options. PNG is a useful starting point for interface screenshots; JPEG and WebP give you alternatives when file size matters. Clipboard copying is available when you want to paste the composition into another tool.

Animated work can be exported as MP4, WebM, or GIF. Choose a format supported by the place you are publishing. A short GIF can work in a context that expects an image, while a video format is usually a better starting point for a longer motion piece.

Editing and export encoding happen in your browser. Your device therefore does the work of producing the output, and larger compositions or longer videos require more resources. Cloud drafts and public sharing are separate online features. Before publishing, look at the result at the size people will actually see, especially if the screenshot contains small text.

## How does Tokokino compare with other tools?

The useful comparison is the work you want to do. Screenshot presentation, graphic layout, and recording software overlap, but they do not all start from the same task. The notes below focus on documented workflows rather than pricing or claims that one tool is best for everyone.

### PostSpark

[PostSpark](https://postspark.app/home) covers screenshot editing, device mockups, social post captures, and video or animation workflows. It is a close alternative if your main job is turning product captures into designed visuals. There is real overlap with Tokokino, including framing and composing existing content.

For Tokokino, look at whether its combination of per-canvas keyframes, separate media and backdrop styling, glass frames, ASCII textures, reusable presets, and browser-based encoding suits your process. A useful way to choose is to make the same product visual in each editor and compare how you reach the layout and motion you want.

### Screen Studio

[Screen Studio](https://screen.studio/) is built around recording on macOS, including automatic zoom and cursor presentation. Its [guide](https://screen.studio/guide) covers recording a display, window, or area, as well as webcam, microphone, and zoom controls. That is a relevant starting point when the job begins with recording a walkthrough.

Tokokino is useful when you already have a screenshot or recording and want to compose it with frames, backgrounds, additional screens, and editable styling. Its keyframes let you direct changes to that composition. If your priority is a recording workflow with automatic zoom, examine Screen Studio; if it is a set of styled stills and motion visuals from existing content, examine Tokokino.

### A general design or video editor

You may already have a broader design or editing workflow. Keep using it for the jobs where you need its particular layout, illustration, or editing tools. Tokokino gives you a focused place to prepare the product visual: import the screen, frame and style it, add context, then export it into the larger project.

You do not have to move an entire campaign into Tokokino to use it. A framed screenshot can become one image in a presentation. A styled recording can become one clip in a longer video. Choose the boundary that saves you repeated setup without giving up the tools you need elsewhere.

## A first project that uses the main features

Try making an announcement for one feature you have recently built. Start with a screenshot that shows the feature clearly. Choose the canvas shape for its destination, add a browser or device frame if it helps, and set a background with enough contrast around the content.

Add a short label and one annotation to explain what changed. Save the styling as a preset if you expect to make more announcements. Export a still, then try an animated version that moves from the full interface to the relevant detail. This gives you two useful outputs while introducing the frame, background, layers, preset, and timeline controls in one project.

[Open Tokokino](/app) to start with your own capture. The [changelog](/changelog) covers new features and improvements as they arrive.
