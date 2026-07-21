// import the global configuration
import { globalConfig } from "../common_configuration.js";

// Determine the correct PiperTTS voice client configuration and set the voiceURL
// for the web client to use.
window.GetVoiceURL = async function() {
  let endpoint;
  let voiceURL="";
  let voiceOrder=0;
  let voicelist;

  // Look through all the valid endpoints looking for an enabled one that functions
  for (let pri = 1; pri <= globalConfig.PiperTTS.endpoints.length; pri++) {
    endpoint = globalConfig.PiperTTS.endpoints.find(endpoint => endpoint.order === pri);
    if(endpoint !== undefined) {
      // Found a potential candidate. Test it.
      if(endpoint.type === "Server") {
        voiceURL = "/pipertts"; // Universal client endpoint for server side queries
      } else {
        voiceURL = endpoint.url;
      }
      // Try obtaining the voice list from the proposed URL. For testing only need to
      // verify that data was returnable.
      try {
        console.log("SetVoiceURL Trying Target:",voiceURL);
        const response = await fetch(voiceURL+"/voices", {method: 'GET'});
        console.log("SetVoiceURL resp=",response.status);
        if (!response.ok) {
          throw new Error("SetVoiceURL: response status:"+response.status);
        }

        // now try to get the data from the request
        voicelist = await response.json();
        if(voicelist.ERROR != undefined) {
          throw new Error("SetVoiceURL: VoiceList Data Error");
        }

      } catch (error) {
        // Error from selected endpont. Try the next endpoint.
        voiceURL=""; //endpoint is not valid, clear value from response.
        continue;
      }
      // Got here means response.ok, so found a valid endpoint. return it.
      voiceOrder = endpoint.order;
      break; // exit for loop
    }

  }
  return { 
    url: voiceURL,
    order: voiceOrder,
  };
}

// Handle querying the Pipertts server for the currently installed voices.
window.GetTTSVoices = async function(ttsURL) {

  var voicelist;

  try {

    const response = await fetch(ttsURL+"/voices", {method: 'GET'});
    console.log("resp=",response.status);

    if (!response.ok) {
      throw new Error("GetTTSVoices: response status:"+response.status);
    }
  

    // The server returns a JSON data object that contains the installed voice data.
    // Note: Async functions always return promises, not the data, so the caller also
    // needs to await or wrap in a .then function to get the final data.
    voicelist = await response.json();

    // Extract the voice names from the returned data.
    switch (ttsURL) {
      case "/pipertts": // server-side PiperTTS server
        voicelist = Object.keys(voicelist); // parse out just the voice names from the data.
        break;
      case "https://basictts.com": // web-based voice data server (public)
        voicelist = voicelist.map(voice => voice.name);
        break;
      default:
        console.log('Using default Piper TTS response formatting. Voice List Format may be wrong');
        voicelist = Object.keys(voicelist); // parse out just the voice names from the data.
    }

  } catch (error) {
    console.error("GetTTSVoices Error=",error.message);
    MsgBox("GetTTSVoices Error",error.message);
    voicelist=JSON.parse('{"ERROR":"'+error.message+'"}');
  }
  return voicelist;
}

// How long to wait for a single synthesis request before giving up. Without this,
// an unresponsive PiperTTS server (the request hangs with no response at all, not
// even an error) leaves the calling fetch() awaiting forever -- and since that's an
// in-flight request, not a config check, toggling voice narration off afterward via
// the UI control can't un-stick it either. This turns "hangs forever" into "fails
// after 20s", which loadAlertVoices()/loadNarrativeVoices() in MainScript.js can
// then actually catch and recover from. 20s is generous (real synthesis of a long
// CAP alert message on modest hardware can legitimately take some seconds) but bounded.
const TTS_TIMEOUT_MS = 20000;

window.ttsGetSpeech = async function(SpeechStr,ttsURL,voiceSelect) {
// This function retrieves the audio speech blob from the configured tts Server
// and returns a memory URL to the voice file.
  // Call the PiperTTS voice server to synthesize the voice.

  // Determine the URI to fetch based on the PiperTTS target server.
  let ttsURI;
  switch (ttsURL) {
    case "/pipertts": // server-side PiperTTS server
      ttsURI = ttsURL+"/speech";
      break;
    case "https://basictts.com": // web-based voice data server (public)
      ttsURI = ttsURL +"/synthesize"
      break;
    default:
      console.log('Using default Piper TTS Speech URI formatting.');
      ttsURI = ttsURL+"/";
  }
  const timeoutController = new AbortController();
  const timeoutTimer = setTimeout(() => timeoutController.abort(), TTS_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(ttsURI, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ text: SpeechStr, voice: voiceSelect }),
      signal: timeoutController.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`tts Server did not respond within ${TTS_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutTimer);
  }

  if (!response.ok) {
    console.log("response status:"+response.status);
    if (!response.ok) {
      console.log("response still not ok");
    }
    throw new Error('tts Server Response was not ok');
  }

  // Process the web server response and create an audio URL.
  let audioURL;
  switch (ttsURL) {
    case "/pipertts": // server-side PiperTTS server
      // The Piper API returns an audio file (e.g., WAV/OPUS binary data)
      const audioBlob = await response.blob();
      audioURL = URL.createObjectURL(audioBlob);
      break;
    case "https://basictts.com": // web-based voice data server (public)
      // The Piper API returns an audio file (e.g., WAV/OPUS binary data)
      const data = await response.json();
      audioURL = data.audioUrl;
      break;
    default:
      console.log('Using default Piper TTS Speech audioURL.');
      const audioBlob1 = await response.blob();
      audioURL = URL.createObjectURL(audioBlob1);
  }

 return audioURL;

}

