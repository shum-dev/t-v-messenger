import React, { Component } from 'react';
import SideBar from './SideBar';
import LoginForm from './LoginForm';
import Room from './Room';

import '../styles/ChatContainer.css';

export default class ChatContainer extends Component {
  render() {
    const { user, logOut, history, socket, logIn, activeChat,
            setActiveChat, createMessage, createRoom } = this.props;
    if(user){
      return (
        <div className='ChatContainer'>
          <SideBar
            createRoom={createRoom}
            logOut={logOut}
            history={history}
            chats={user.rooms}
            user={user}
            activeChat={activeChat}
            setActiveChat={setActiveChat}
          />
          {activeChat ? (
            <Room activeChat={activeChat} user={user} createMessage={createMessage} />
          ) : (
            <div className='ChatContainer choose'>
              <h1>Choose a chat!</h1>
            </div>
          )}

        </div>
      )
    }
    return <LoginForm socket={socket} logIn={logIn} />
  }
}