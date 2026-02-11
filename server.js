// NodeJS Express Webserver Configuration File for the PiperTTS Server
// Version 1.1 - February 2026

// Common configuration items are host and port. See below.
// for host 0.0.0.0 listens on all interfaces.
const host = '0.0.0.0';
const port = 3000;

// NodeJS Web Services and support functions
import express from 'express';
import {Readable} from 'node:stream';
import os from 'os';

// This is the import of the shared configuration file that controls how the IntelliSTAR
// emulator interacts with available PiperTTS voice servers.
import {globalConfig} from './common_configuration.js';
import * as piperTTS from './PiperTTSInterface.js';

// Simple function to get all the valid ip4 addresses on the computer
function getIP4Addresses() {
  const nets = os.networkInterfaces();
  const results = []; // Use an array to store all valid addresses
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.address.split(".").length === 4) { // Got 4 octets may be a valid IP
        results.push(net.address);
      }
    }
  }
  return results;
}

// This function reads the common configuation file looking for Server-Side PiperTTS configuration.
// If it is found then the server attempts to communicate with the PiperTTS server.
// Status is reported on the console.

console.log("Checking for PiperTTS Voice Server Avaiability...");
const {url: INT_TTS_SERVER, order: INT_TTS_ORDER } = await piperTTS.GetVoiceURL();
if(INT_TTS_ORDER === 0) {
    console.log("Server Side Piper TTS Server not enabled.");
} else {
    console.log(`Server Side Piper TTS Server is available. Order#${INT_TTS_ORDER}. Server URL:${INT_TTS_SERVER}`);
}

// Main IntelliSTAR Web Server
const app = express();
app.use(express.static('.'));

// Parse incoming requests with JSON payloads
app.use(express.json());

// Define an API endpoint (a route) that calls the Piper TTS function to get installed voices.
app.get('/pipertts/voices', async (req, res) => {
    console.log("SS Endpoint pipertts/voices. Reqpath="+req.path);
    const result = await piperTTS.GetTTSVoices(INT_TTS_SERVER);
    res.status(200).json(result); // Send the result back as JSON
});

// Define an API endpoint (a route) that calls the Piper TTS function to return Speech data.
app.post('/pipertts/speech', async (req, res) => {
    console.log("SS Endpoint pipertts/speech. Reqpath="+req.path);
    const spStr = req.body.text;
    const voiceSel = req.body.voice;
    console.log("Speaking. Voice=",voiceSel," Text=",spStr);
    const result = await piperTTS.GetSpeech(INT_TTS_SERVER,spStr,voiceSel);

    // result should be a blob containing voice speech in audio/wav format.
    // return this encoded data back to the caller.
    const src = Readable.fromWeb(result.stream());
    res.header('Content-Type','audio/wav');
    res.header('Content-Length',result.size);
    src.pipe(res);
});

app.listen(port, host, () => {
    console.log("------------------------------------------");
    const aIPList = getIP4Addresses();
    for (let i = 0; i < aIPList.length; i++) {
        console.log(`Local on the 8's Server running on http://${aIPList[i]}:${port}`);
    }
});
