import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import ChatHeading from './ChatHeading';
import Messages from './Messages';
import MessageInput from './MessageInput';
import { JOIN_ROOM, EXIT_ROOM, STREAMING, SIGNAL, STREAM_REQEST, CLOSE_CONNECTION } from '../Events';

// import { getMediaStream, closeVideoCall, createPeerConnections, handleTrackEvent } from '../webRTC';

import '../styles/Room.css';

let peerConnection; // consumer connection
let historyRemoveListener;

class Room extends Component {
  constructor(props) {
    super(props);
    this.state = {
      usersOnline: [],
      streamer: null,
      peerConnections: [] // all streamer connections
    }
  }
  componentDidMount(){
    const { socket, user, history } = this.props;
    const { remoteVideo, localVideo } = this.refs;
    // set history listener for manage RTCPeerConnection when the url is changing
    historyRemoveListener = history.listen(this.historyHandler);

    socket.on(JOIN_ROOM, (usersOnline, streamer) => {
      console.log('JOIN_ROOM fired.');
      console.log('Your socket ID: ', socket.id );
      let filteredCurrentUser = usersOnline.filter(item => item !== socket.id);
      console.log('Users in state: ', filteredCurrentUser);
      console.log('Streamer in state: ', streamer);
      this.setState({usersOnline: filteredCurrentUser, streamer});
    });

    socket.on(EXIT_ROOM, usersOnline => {
      console.log('EXIT_ROOM fired.');
      let filteredCurrentUser = usersOnline.filter(item => item !== socket.id);
      this.setState({usersOnline: filteredCurrentUser});
    });

    socket.on(STREAMING, streamer => {
      this.setState({streamer});
      console.log('user: ', user, 'streamer: ', streamer);

      if(!streamer) {
        console.log('Close remote video');
        if (remoteVideo.srcObject) {
          remoteVideo.srcObject.getTracks().forEach(track => track.stop());
          remoteVideo.removeAttribute("src");
          remoteVideo.removeAttribute("srcObject");
          remoteVideo.style.display = 'none';
        }
        // display remote video canvas if current user !== streamer
      } else if(socket.id !== streamer ) {
        remoteVideo.style.display = 'block';
      }
    });

    socket.on(STREAM_REQEST, remoteSocket => {
      console.log('STREAM_REQ is fired!');
      console.log('Remote socket is: ', remoteSocket);
      let peerConnection = this.createPeerConnections([remoteSocket])[0];
      let localStream = localVideo.srcObject;
      console.log('localStream is: ', localStream);
      console.log('PeerConnection is: ', peerConnection);
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
      this.setState((prevState) => {
        return {
          peerConnections: [...prevState.peerConnections, peerConnection]
        }
      });
    });

    socket.on(SIGNAL, message => {
      switch(message.type) {
        case 'video-offer':
          console.log('#5.1 Video offer is recieved from: ', message.owner);
          peerConnection = this.createPeerConnections([message.owner])[0];
          console.log('#6 Set remote description for new connection');
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
            console.log('Answer is fired from:', socket.id,' to: ', message.owner);
            console.log('peerConnection is: ', peerConnection);
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
          console.log('#9 Answer is coming from: ', message.owner);
          peerConnection = this.state.peerConnections.filter(item => item.targetSocket === message.owner)[0];
          console.log('#10 set remote description');
          peerConnection.setRemoteDescription(message.sdp)
          .catch(err => {
            console.log('Something goes wrong in setRemoteDescription(): ', err);
          });
          break;
        case 'new-ice-candidate':
          console.log('# recieved new ICe candidate');
          console.log('peerConnection is: ', peerConnection);
          let candidate = new RTCIceCandidate(message.candidate);
          peerConnection.addIceCandidate(candidate)
            .catch(err => {
              console.log('Something goes wrong on new-ice-candidate: ', err);
            })
          break;
        default:
          console.log('No such event in signaling server');
      }

    });

    socket.on(CLOSE_CONNECTION, socketId => {
      const { peerConnections } = this.state;
      console.log('Streamer recieve CLOSE_CONNECTION from: ', socketId);
      const targetConnection = peerConnections.filter(connection => connection.targetSocket === socketId)[0];
      this.closeVideoCall([targetConnection]);
        // remove closed connection from the state
      this.setState((prevState) => {
        const filteredConnections = prevState.peerConnections.filter(connection => {
          return connection.targetSocket !== socketId;
        });
        return {
          peerConnections: filteredConnections
        }
      });
  });
  }
  componentWillUnmount(){
    const { socket } = this.props;
    console.log('Room unmount');
    // unsubscribe from all socket events and history.listen()
    // this needs in case with logIn/logOut chain (when socket stay the same)
    socket.removeAllListeners();
    historyRemoveListener();
  }
  historyHandler = () => {
    const { streamer } = this.state;
    const { user, socket } = this.props;
    const { remoteVideo } = this.refs;
    // when streamer leave current url - end streaming
    if(streamer && streamer === socket.id) {
      this.toggleStreaming();
      return;
    }
    // when consumer leave current url - close certain peerConnection
    if(streamer && streamer !== socket.id){
      if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.removeAttribute("src");
        remoteVideo.removeAttribute("srcObject");
        remoteVideo.style.display = 'none';
      }
      this.closeVideoCall([peerConnection]);
      socket.emit(CLOSE_CONNECTION, peerConnection.targetSocket);
      return;
    }
  }
  createPeerConnections = targetSockets => {
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
      pc.onicecandidate = this.handleICECandidateEvent;
      pc.ontrack = this.handleTrackEvent;
      pc.onnegotiationneeded = this.handleNegotatiationNeededEvent;
      pc.onremovetrack = this.handleRemoveTrackEvent;
      pc.oniceconnectionstatechange = this.handleICEConnectionStateChangeEvent;
      pc.onicegatheringstatechange = this.handleICEGatheringStateChangeEvent;
      pc.onsignalingstatechange = this.handleSignalingStateChangeEvent;
      pc.targetSocket = item;
      pConnections[i] = pc;
    });
    return pConnections;
  }
  handleNegotatiationNeededEvent = event => {
    const { socket } = this.props;
    console.log('#3 Negotiation needed is fired');
    // key word this refer to certain peerConnection
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
      .then(() => { // say to all about streamer (indetify by socket ID)
        const { activeChat } = this.props;
        socket.emit(STREAMING, socket.id, activeChat._id);
      })
      .catch(err => {
        console.log('Error occure in createOffer(): ', err);
      })
  }
  handleICECandidateEvent = event => {
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
    console.log('# Fire Track event');
    this.refs.remoteVideo.srcObject = event.streams[0];
  }
  // this function just for debugging purpose
  handleICEConnectionStateChangeEvent = event => {
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
  handleICEGatheringStateChangeEvent(event) {
    console.log('ICE Gathering state change: ', event.target.iceGatheringState);
  }
  // this function just for debugging purpose
  handleSignalingStateChangeEvent(event) {
    console.log('Signaling state change: ', event.target.signalingState);
  }
  // get stream from user device
  getMediaStream = () => {
    console.log('#2 Get Media stream');
    const { localVideo } = this.refs;
    const { peerConnections } = this.state;
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
    .catch(this.handleGetUserMediaError)
  }
  handleGetUserMediaError(err) {
    const { peerConnections } = this.state;
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
    this.closeVideoCall(peerConnections);
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
    console.log('#ToggleStreaming');
    const { usersOnline, peerConnections } = this.state;
    const { localVideo } = this.refs;
    const { user, socket, activeChat } = this.props;
    // if there is streamer start closing call process
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
      return this.setState({streamer: null, peerConnections: []});
      // prevent streaming if nobody in the room
    } else if( usersOnline.length === 0) {
      alert('There is nobody in the room to broadcast for');
      return;
      // start streaming process
    } else {
      localVideo.style.display = 'block';
      let peerConnections = this.createPeerConnections(usersOnline);
      this.setState({streamer: user, peerConnections}, () => {
        this.getMediaStream();
      });
    }
  }
  render() {
    const { streamer } = this.state;
    const { activeChat, user, createMessage, socket } = this.props;

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
              userSocketId={socket.id}
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

