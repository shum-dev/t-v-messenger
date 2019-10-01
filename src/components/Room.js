import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import ChatHeading from './ChatHeading';
import Messages from './Messages';
import MessageInput from './MessageInput';
import { JOIN_ROOM, EXIT_ROOM, STREAMING, SIGNAL } from '../Events';
// import adapter from 'webrtc-adapter';

// import { getMediaStream, closeVideoCall, createPeerConnections, handleTrackEvent } from '../webRTC';

import '../styles/Room.css';

let peerConnection;

class Room extends Component {
  constructor(props) {
    super(props);
    this.state = {
      usersOnline: [],
      streamer: null,
      peerConnections: []
    }
  }

  componentDidMount(){
    const { socket, user } = this.props;
    const { remoteVideo } = this.refs;
    console.log('Component ROOM mount! Socket is: ', socket.id);

    socket.on(JOIN_ROOM, (usersOnline) => {
      console.log('JOIN_ROOM fired. Data from the server: ', usersOnline);
      let filteredCurrentUser = usersOnline.filter(item => item !== socket.id);
      console.log('Users in state: ', filteredCurrentUser);

      this.setState({usersOnline: filteredCurrentUser});
    });

    socket.on(EXIT_ROOM, (usersOnline) => {
      console.log('EXIT_ROOM fired. Data from the server: ', usersOnline);
      console.log('Socket ID: ', socket.id);
      let filteredCurrentUser = usersOnline.filter(item => item !== socket.id);
      console.log('Users in state: ', filteredCurrentUser);
      this.setState({usersOnline: filteredCurrentUser});
    });

    socket.on(STREAMING, (streamer) => {
      console.log('Recieved Streamer: ', user);
      this.setState({streamer});
      if(!streamer) {
        console.log('Close remote video2');
        if (remoteVideo.srcObject) {
          remoteVideo.srcObject.getTracks().forEach(track => track.stop());
          remoteVideo.removeAttribute("src");
          remoteVideo.removeAttribute("srcObject");
          remoteVideo.style.display = 'none';
        }
      } else if(user._id !== streamer._id ) { // display remote video if current user !== streamer
        remoteVideo.style.display = 'block';
      }
    });

    socket.on(SIGNAL, message => {
      switch(message.type) {
        case 'video-offer':
          console.log('#5.1 Video offer is recieved: ', message);

          peerConnection = this.createPeerConnections([message.owner])[0];
          console.log('#6 Set remote description for connection: ', peerConnection);

          peerConnection.setRemoteDescription(message.sdp)
          .then(() => {
            console.log('#7 create answer');

            return peerConnection.createAnswer();
          })
          .then(answer => {
            console.log('#8 Set local description');
            return peerConnection.setLocalDescription(answer);
          })
          .then(() => {
            console.log('Answer is fired. From:', socket.id,' to: ', message.owner);
            console.log('sdp is: ', peerConnection);
            socket.emit(SIGNAL, {
              owner: socket.id,
              target: message.owner,
              type: 'answer',
              sdp: peerConnection.localDescription
            })
          })
          .catch(err => {
            console.log('Something goes wrong in answering: ', err);
          });
          break;
        case 'answer':
          console.log('#9 Answer is coming');
          console.log('Message is: ', message);
          peerConnection = this.state.peerConnections.filter(item => item.targetSocket === message.owner)[0];
          console.log('#10 set remote description');
          peerConnection.setRemoteDescription(message.sdp)
          .catch(err => {
            console.log('Something goes wrong in setRemoteDescription(): ', err);
          });
          break;
        case 'new-ice-candidate':
          console.log('# recieved new ICe candidate: ', message);
          console.log('peerConnection is: ', peerConnection);

          let candidate = new RTCIceCandidate(message.candidate);
          // if(peerConnection){
            peerConnection.addIceCandidate(candidate)
            .catch(err => {
              console.log('Something goes wrong on new-ice-candidate: ', err);
            })
          // }
          break;
        default:
          console.log('No such event in signaling server');

      }

    });
  }
  componentWillUnmount(){
    const { socket } = this.props;
    console.log('Room unmount');
    socket.removeAllListeners();
  }
  createPeerConnections = (targetSockets) => {
    console.log('#2 Create Peer Conections');

    let pConnections = [];
    targetSockets.forEach((item, i) => {
      let pc = new RTCPeerConnection({
        iceServers: [
          {
            urls: 'stun:stun.l.google.com:19302'
          }
        ]
      });
      pc.onicecandidate = this.handleICECandidateEvent;
      pc.ontrack = this.handleTrackEvent;
      pc.onnegotiationneeded = this.handleNegotatiationNeededEvent;
      pc.onremovetrack = this.handleRemoveTrackEvent;
      pc.oniceconnectionstatechange = this.handleICEConnectionStateChangeEvent;
      pc.onicegatheringstatechange = this.handleICEGatheringStateChangeEvent;
      pc.onsignalingstatechange = this.handleSignalingStateChangeEvent;
      // return pc;
      pc.targetSocket = item;
      pConnections[i] = pc;
    });

    return pConnections;
  }

  handleNegotatiationNeededEvent = (event) => {
    const { socket } = this.props;
    console.log('#3 Negotiation needed is fired');
    // key word this refer to certain peerConnection
    event.target.createOffer()
      .then(offer => {
        console.log('#4 Set local description for: ', event.target);
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
      .then(() => { // said to all about streamer
        const { activeChat, user } = this.props;
        socket.emit(STREAMING, user, activeChat._id);
      })
      .catch(err => {
        console.log('Error occure in createOffer(): ', err);
      })
  }
  handleICECandidateEvent = (event) => {
    const { socket } = this.props;
    console.log('# Send Ice candidate from: ', socket.id, ' to: ', event.target.targetSocket);
    if(event.candidate) {
      socket.emit(SIGNAL, {
        type: 'new-ice-candidate',
        target: event.target.targetSocket,
        candidate: event.candidate
      });
    }
  }
  handleTrackEvent = (event) => {
    console.log('#11 Finnaly fire Track event');
    this.refs.remoteVideo.srcObject = event.streams[0];
  }
  handleRemoveTrackEvent(){
    console.log('RemoveTrackEvent: ', arguments);
  }
  handleICEConnectionStateChangeEvent = (event) => {
    console.log('ICE connection state change');
    switch(event.target.iceConnectionState){
      case 'closed':
      case 'failed':
      case 'disconnected':
        console.log('CLOSE CALL');
        this.closeVideoCall([event.target]);
        break;
      default:
        console.log('ICE Connection State: ', event.target.iceConnectionState);
    }
  }
  handleICEGatheringStateChangeEvent(event) {
    console.log('ICE Gathering state change: ', event.target.iceGatheringState);
  }
  handleSignalingStateChangeEvent(event) {
    console.log('Signaling state change: ', event.target.signalingState);
  }
  getMediaStream = () => {
    console.log('#1 Get Media stream');
    const { localVideo } = this.refs;
    const { peerConnections } = this.state;
    navigator.mediaDevices.getUserMedia({
      // audio: true,
      video: true
    })
    .then(localStream => {
      console.log('Adding local stream. Local stream is: ', localStream);
      localVideo.srcObject = localStream;
      // console.log('Generated pConnections: ', peerConnections);
      // cb(peerConnections);
      localStream.getTracks().forEach(track => {
        peerConnections.forEach(connection => connection.addTrack(track, localStream));
      });
    })
    .catch(this.handleGetUserMediaError)
  }
  handleGetUserMediaError(err) {
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
    // closeVideoCall();
  }

  closeVideoCall(peerConnections) {
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

  toggleStreaming = () => {
    const { usersOnline, peerConnections } = this.state;
    const { localVideo, remoteVideo } = this.refs;
    const { user, socket, activeChat } = this.props;
    if(this.state.streamer){
      console.log('Fire close video call');
      if (localVideo.srcObject) {
        localVideo.srcObject.getTracks().forEach(track => track.stop());
      }
      localVideo.removeAttribute("src");
      localVideo.removeAttribute("srcObject");
      localVideo.style.display = 'none';
      this.closeVideoCall(peerConnections);
      socket.emit(STREAMING, null, activeChat._id);
      console.log('Set state to the null');
      this.setState({streamer: null, peerConnections: []});
    } else {
      // TODO: don't create stream if nobody in room
      localVideo.style.display = 'block';
      // let callback = (peerConnections) => {
        // this.setState({streamer: user, peerConnections})
      // }
      let peerConnections = this.createPeerConnections(usersOnline);
      this.setState({streamer: user, peerConnections}, () => {
        this.getMediaStream();
      });
    }
  }

  render() {
    const { streamer } = this.state;
    const { activeChat, user, createMessage } = this.props;
    return (
      <div className='Room'>
          <div className='Room-chat'>
            <ChatHeading activeChat={activeChat} user={user.name} />
            <Messages
              messages={activeChat.messages}
              user={user}
            />
            <MessageInput
              sendMessage={createMessage}
              toggleStreaming={this.toggleStreaming}
              streamer={streamer}
              userId={user._id}
            />
          </div>
          <div className='Room-stream'>
            <video id='remoteVideo' ref='remoteVideo' autoPlay></video>
            <video id='localVideo' ref='localVideo' autoPlay muted></video>
          </div>
      </div>
    )
  }
}

export default withRouter(Room);

