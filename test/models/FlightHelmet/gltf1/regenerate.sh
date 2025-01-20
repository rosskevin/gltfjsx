#!/bin/bash

rm -f  *.tsx
npx gltfjsx ./FlightHelmet.gltf -o OldReference.tsx --types --keepnames --shadows