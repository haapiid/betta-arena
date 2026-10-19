import { Config } from '@remotion/cli/config'

Config.setEntryPoint('./src/index.ts')
Config.setVideoImageFormat('jpeg')
Config.setJpegQuality(95)
Config.setOverwriteOutput(true)
Config.setPixelFormat('yuv420p')
Config.setColorSpace('bt709')
// If Remotion cannot download its headless Chrome, point it at an installed Chromium browser:
// Config.setBrowserExecutable('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
