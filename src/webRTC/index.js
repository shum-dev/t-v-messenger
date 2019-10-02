import { socket } from '../socketIO';
import { SIGNAL, STREAMING } from '../Events';

function createPeerConnections(targetSockets, activeChatId, remoteVideo) {
  console.log('#1 Create Peer Conections');
  let pConnections = [];
  targetSockets.forEach((item, i) => {
    let pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302'
        }, {
          urls: 'turn:numb.viagenie.ca',
          username: 'webrtc@live.com',
          credential: 'muazkh'
        }
      ]
    });
    pc.onicecandidate = handleICECandidateEvent;
    pc.ontrack = handleTrackEvent.bind(pc, remoteVideo);
    pc.onnegotiationneeded = handleNegotatiationNeededEvent.bind(pc, activeChatId);
    pc.oniceconnectionstatechange = handleICEConnectionStateChangeEvent;
    pc.onicegatheringstatechange = handleICEGatheringStateChangeEvent;
    pc.onsignalingstatechange = handleSignalingStateChangeEvent;
    pc.targetSocket = item;
    pConnections[i] = pc;
  });
  return pConnections;
}

function handleICECandidateEvent(event) {
  // const { socket } = this.props;
  console.log('# Send Ice candidate from: ', socket.id, ' to: ', event.target.targetSocket);
  if(event.candidate) {
    socket.emit(SIGNAL, {
      type: 'new-ice-candidate',
      target: event.target.targetSocket,
      candidate: event.candidate
    });
  }
}

function handleTrackEvent(remoteVideo, event) {
  console.log('# Fire Track event');
  remoteVideo.srcObject = event.streams[0];
}

function handleNegotatiationNeededEvent(activeChatId, event) {
  console.log('#3 Negotiation needed is fired. Arguments is: ', arguments);
  // key word this refer to certain peerConnection (this VS event.target)
  event.target.createOffer()
    .then(offer => {
      console.log('#4 Set local description for: ', event.target.targetSocket);
      return event.target.setLocalDescription(offer);
    })
    .then(() => {
      console.log('#4.1 send offer from: ', socket.id, ' to: ', event.target.targetSocket);
      socket.emit(SIGNAL, {
        owner: socket.id,
        target: event.target.targetSocket,
        type: 'video-offer',
        sdp: event.target.localDescription
      })
    })
    .then(() => { // say all about streamer (indetify by socket ID)
      socket.emit(STREAMING, socket.id, activeChatId);
    })
    .catch(err => {
      console.log('Error occure in createOffer(): ', err);
    })
}
// this function just for debugging purpose
function handleICEConnectionStateChangeEvent(event) {
  console.log('ICE connection state change: ', event.target.iceGatheringState);
  switch(event.target.iceConnectionState){
    case 'closed':
    case 'failed':
    case 'disconnected':
      console.log('CLOSE CALL');
      break;
    default: return;
  }
}
// this function just for debugging purpose
function handleICEGatheringStateChangeEvent(event) {
  console.log('ICE Gathering state change: ', event.target.iceGatheringState);
}
// this function just for debugging purpose
function handleSignalingStateChangeEvent(event) {
  console.log('Signaling state change: ', event.target.signalingState);
}
// get stream from user device
function getMediaStream(localVideo, peerConnections) {
  console.log('#2 Get Media stream');
  navigator.mediaDevices.getUserMedia({
    // audio: true,
    video: true
  })
  .then(localStream => {
    console.log('Adding local stream. Local stream is: ', localStream);
    localVideo.srcObject = localStream;
    // add local stream to all peer connections
    localStream.getTracks().forEach(track => {
      peerConnections.forEach(connection => connection.addTrack(track, localStream));
    });
  })
  .catch(handleGetUserMediaError)
}

function handleGetUserMediaError(err) { /* ======== peerConnections */
  // const { peerConnections } = this.state;
  switch(err.name) {
    case "NotFoundError":
      alert("Unable to open your call because no camera and/or microphone were found.");
      break;
    case "SecurityError":
    case "PermissionDeniedError":
      // Do nothing; this is the same as the user canceling the call.
      break;
    default:
      alert("Error opening your camera and/or microphone: " + err.message);
      break;
  }
  // closeVideoCall(peerConnections);
}

function closeVideoCall(peerConnections) {
  console.log('Close videocall is invoked');
  peerConnections.forEach(connection => {
    console.log('Closing peer connection: ', connection);
    connection.ontrack = null;
    connection.onremovetrack = null;
    connection.onremovestream = null;
    connection.onicecandidate = null;
    connection.oniceconnectionstatechange = null;
    connection.onsignalingstatechange = null;
    connection.onicegatheringstatechange = null;
    connection.onnegotiationneeded = null;
    connection.close();
    connection = null;
  });
}



export {
  createPeerConnections,
  getMediaStream,
  closeVideoCall
}