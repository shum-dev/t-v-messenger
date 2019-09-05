import React, { Component } from 'react';
import SideBar from './SideBar';
import ChatHeading from './ChatHeading';
import Messages from './Messages';
import MessageInput from './MessageInput';
import LoginForm from './LoginForm';
import { CREATE_NEW_ROOM, CREATE_NEW_MESSAGE, ADD_NEW_MESSAGE, ROOM_ACCESS } from '../Events';

import '../styles/ChatContainer.css';

export default class ChatContainer extends Component {
  constructor(props) {
    super(props);
    this.state={
      chats: this.props.user ? this.props.user.rooms : null,
      activeChat: this.props.activeChat,
    };
  }
  componentDidMount(){
    const { socket } = this.props;
    socket.on(ADD_NEW_MESSAGE, (updatedRoom) => {
      this.updateCurrentChatsInState(updatedRoom);
    });

    socket.on(ROOM_ACCESS, (updatedRoom) => {
      this.updateCurrentChatsInState(updatedRoom);
    });
  }
  // hard update state (needed for logIn/logOut chain works correctly)
  componentDidUpdate(prevProps, prevState){
    if(this.props.user && (prevState.chats !== this.props.user.rooms)){
      this.setState({ chats: this.props.user.rooms})
    }
  }
  // update current state with recieved data from server
  updateCurrentChatsInState = (updatedRoom) => {
    const { chats } = this.state;
    let newChats = chats.map( chat => {
      if(chat._id === updatedRoom._id){
        return updatedRoom;
      }
      return chat;
    });
    this.setState((prevState) =>{
      if(prevState.activeChat && (prevState.activeChat._id === updatedRoom._id)){
        return ({
          chats: newChats,
          activeChat: updatedRoom
        })
      }
      return ({
        chats: newChats
      })
    });
  }
  //create chat on server-side
  createRoom = (roomName) => {
    const { socket } = this.props;
    socket.emit(CREATE_NEW_ROOM, roomName, this.props.user.name, this.addRoom);
  }
  //add chat to the state
  addRoom = (updatedUser) => {
    this.props.logIn(updatedUser); // call .logIn() just for sync purpose
    this.setState({chats: updatedUser.rooms });
  }
  setActiveChat = (activeChat) => {
    this.setState({activeChat});
    if(activeChat){
      this.props.history.push(`/${activeChat._id}`);
    } else {
      // reset .history.push() if user click somewhere outside chat list
      this.props.history.push(`/`);
    }
  }
  // create message on server-side
  createMessage = (message) => {
    const { socket } = this.props;
    socket.emit(CREATE_NEW_MESSAGE, {
      roomId: this.state.activeChat._id,
      message,
      userId: this.props.user._id
    });
  }
  render() {
    const { chats, activeChat } = this.state;
    const { user, logOut, history, socket, logIn} = this.props;
    if(user){
      return (
        <div className='ChatContainer'>
          <SideBar
            createRoom={this.createRoom}
            logOut={logOut}
            history={history}
            chats={chats}
            user={user}
            activeChat={activeChat}
            setActiveChat={this.setActiveChat}
          />
          <div className='chat-room-container'>
            {
              activeChat ? (
                <div className='chat-room'>
                  <ChatHeading activeChat={{...activeChat}} user={user.name} />
                  <Messages
                    messages={activeChat.messages}
                    user={user}
                  />
                  <MessageInput
                    sendMessage={this.createMessage}
                  />
                </div>
              ) : (
                <div className='chat-room choose'>
                  <h1>Choose a chat!</h1>
                </div>
              )
            }
          </div>
        </div>
      )
    }
    return <LoginForm socket={socket} logIn={logIn} />
  }
}