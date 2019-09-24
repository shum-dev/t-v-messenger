import React, { Component } from 'react';
import ChatHeading from './ChatHeading';
import Messages from './Messages';
import MessageInput from './MessageInput';

import '../styles/Room.css';

class Room extends Component {
  constructor(props) {
    super(props);
    this.state = {
      usersOnline: []
    }
  }
  render() {
    const {activeChat, user, createMessage} = this.props;
    return (
      <div className='Room'>
        {
            <div className='Room-chat'>
              <ChatHeading activeChat={activeChat} user={user.name} />
              <Messages
                messages={activeChat.messages}
                user={user}
              />
              <MessageInput
                sendMessage={createMessage}
              />
            </div>
        }
      </div>
    )
  }
}

export default Room;

