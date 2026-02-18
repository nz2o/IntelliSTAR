### TWC Local on the 8's IntelliSTAR Emulator

This is an website HTML/Javascript emulation of the Weather Channel's Local on the 8's IntelliSTAR system.

Original fork from: [GitHub - qconrad/intellistar-emulator: A web application that displays weather information in the same visual presentation as the cable headend unit Intellistar.](https://github.com/qconrad/intellistar-emulator)

#### Summary of Enhancements in this Fork:

+ Full Voice Narration Support using the PiperTTS Engine
- Full Weather Alert Support
  
  - including separate pages for each alert.

- URL Parameter Direct Start

- Settings Stored in Browser User Persistence

- Updated UI Dialog
  
  - including expanded control over many options

- Myriad of Bug Fixes

- Updates to Page Sequencing to Match Actual Local on the 8's

- Easy to Understand Deployment Instructions (I hope...)

This project was requested by my son Matthew, and is dedicated to him. May his love for all things weather and the Weather Channel never diminish.

#### Release Summary

Version 1.1.0 - Major code refactoring to make deployment and distribution easier.\
Version 1.0.0 - Initial Push to Github.

#### Live Project Demo: [IntelliSTAR Emulator](https://fillimerica.github.io/IntelliSTAR/)

#### Deployment Options

1. Clone and host on your favorite webserver.

2. Clone and host locally self-hosted.
   
   Tested using Node.JS locally on Windows and Linux. I'm guessing that other web servers such as apache and IIS would also work, although I haven't tested those options.

#### Handling the real-time voice narration:

Real-time voice narration requires access to a PiperTTS web based voice server.

1. If deploying to a webserver, you should also host a PiperTTS instance on a different port.

2. If deploying the self-hosted option, an internal PiperTTS instance can be hosted on the same computer. There are instructions on how to do this further down in this document.

Note: There are a very few publicly accessible PiperTTS web servers and no guarantee that the sponsors will keep them active open and free. As of January 2026, I am aware of the following options:

1. pythonanywhere.com offers a limited free hosting account that is suitable for hosting a PiperTTS server with a limited number of voices. I will include a link to documentation and a youtube video for help using this option.

2. basictts.com provides a limited PiperTTS server with about eight US and UK voices. As of January 2026 it is operational and works without any additional conmfiguration.

As of January 2026 the project was internal and unversioned. Now that it is mostly complete will be updating the github repo and will be including a version on the main UI screen.

#### Deployment Instructions: [Local Deployment](./docs/Local_Deployment_Instructions.md)

#### General Usage Instructions: [Operation Instructions](./docs/IntelliSTAR_Operation.md)
---
#### Cloud Based PiperTTS Server Configuration using PythonAnywhere
A local PiperTTS server instance is the preferred configuration and is covered in the main Deployment Instructions. However, there may be situations where the desired web server host doesn't allow or support this option.

In this tutorial I explore using the commercial python hosting service pythonanywhere.com to host a PiperTTS voice server instance. 

DISCLAIMER: _I am not a sponsor, do not control nor influence the product availability or costs of this option, nor can I guarantee this will remain a viable option in the future._

#### Link to Tutorial Video: [PiperTTS Cloud Deployment](https://youtu.be/rpK0eaShpgE)

#### Configuring the IntelliSTAR Emulator to Use a PythonAnywhere Hosted PiperTTS Server
> [!IMPORTANT]
>You will need the complete web address (url) of the operational PiperTTS server prior to updating the IntelliSTAR emulator configuration. Please follow the instructions in the tutorial video above first.

#### Configure non-local PiperTTS voice server interface: [Instructions](./docs/IntelliSTAR_Configuration_Troubleshooting.md#configuring-the-intellistar-emulator-to-use-a-pythonanywhere-hosted-pipertts-server)


