import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import ChatHeading from './ChatHeading';
import Messages from './Messages';
import MessageInput from './MessageInput';
import { JOIN_ROOM, EXIT_ROOM, STREAMING, SIGNAL, STREAM_REQEST, CLOSE_CONNECTION } from '../Events';

import { createPeerConnections, getMediaStream, closeVideoCall } from '../webRTC';

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
      } else if(socket.id !== streamer) {
        remoteVideo.style.display = 'block';
      }
    });

    socket.on(STREAM_REQEST, remoteSocket => {
      const { activeChat } = this.props;
      console.log('STREAM_REQ is fired!');
      console.log('Remote socket is: ', remoteSocket);
      let peerConnection = createPeerConnections([remoteSocket], activeChat._id)[0];
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
      const { activeChat } = this.props;
      switch(message.type) {
        case 'video-offer':
          console.log('#5.1 Video offer is recieved from: ', message.owner);
          peerConnection = createPeerConnections([message.owner], activeChat._id, remoteVideo)[0];
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
      closeVideoCall([targetConnection]);
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
    const { socket } = this.props;
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
      closeVideoCall([peerConnection]);
      socket.emit(CLOSE_CONNECTION, peerConnection.targetSocket);
      return;
    }
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
      closeVideoCall(peerConnections);
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
      let peerConnections = createPeerConnections(usersOnline, activeChat._id);
      this.setState({streamer: user, peerConnections}, () => {
        getMediaStream(localVideo, peerConnections);
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

