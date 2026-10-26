# Multi Vault — Product Requirements Document (PRD)

**Version:** 1.0 | **Project:** Multi Vault New Version | **Type:** New project from scratch

## Overview
Multi Vault is a personal knowledge website for notes, tags, search, daily journaling, and a knowledge graph. Create it in a new folder named `Multi Vault New Version`. Do not copy, edit, or depend on any previous project.

## Core features
- **Authentication:** registration, sign-in/out, secure password hashing, protected API routes, and user-level data isolation.
- **Dashboard:** real note/tag/journal counts, recent notes, New Note action, journal shortcut, and useful empty state. Never fake metrics.
- **Notes:** create/read/update/delete; title, content, tags, timestamps; search; tag filtering; sorting; save/error feedback; deletion confirmation; prevent accidental loss of unsaved edits.
- **Tags:** add/remove tags, browse tags/counts, filter notes, normalize names to avoid duplicates.
- **Daily journal:** create/view/update one entry per user per date; journal history; consistent date handling.
- **Knowledge graph:** notes as nodes, real links as edges, based on explicit note links and/or shared tags. Explain the connection rules; do not claim AI inference unless implemented.
- **Settings:** only real, working settings and sign-out.

## Design
Use a premium dark “Obsidian Vault” style: deep charcoal surfaces, restrained violet accents, readable typography, subtle borders, generous spacing, and responsive desktop/tablet/mobile layouts. Follow `DESIGN_SPEC.md`.

## Separate frontend alternatives
Build React, Angular, and Vue.js as **three separate applications**, in that order. All share the same Node.js/Express API and MongoDB database. Finish and test one frontend before starting the next.

## Out of scope unless approved
AI summaries, collaboration, public sharing, payments, native mobile apps, and external integrations.

## Acceptance criteria
Authentication, note CRUD, search/tags, unique daily journal entries, real graph relationships, MongoDB persistence, user data isolation, responsive accessible layouts, and loading/empty/success/error states work. Report tests as passed only if actually run.
