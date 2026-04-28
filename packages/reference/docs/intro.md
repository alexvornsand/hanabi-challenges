---
title: Introduction
sidebar_position: 1
slug: /
---

# Hanabi Challenges — Reference

Events on this platform are configured through a structured text file. You describe what the event looks like — how it's organized, how games are scored, who can register, when it runs — and the platform handles the rest.

## How to use this reference

The reference is organized to follow the structure of a config file. Start with **[event](event/)**, which covers the top-level fields and links out to each sub-object. From there, follow the links down: `event` links to `sections`, `sections` links to `slots`, and so on. Each page documents one level of the hierarchy — what fields it accepts, what they mean, and whether they're required.

If you're writing scoring logic or award conditions, **[Expressions](expressions)** covers the formula syntax used throughout.

The **[Examples](examples/nvc)** section has annotated configs for real event formats, which can be a faster starting point than reading from the top.
