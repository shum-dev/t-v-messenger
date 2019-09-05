import React, { Component } from 'react';

import '../styles/Messages.css';

export default class Messages extends Component {
  componentDidMount(){
    this.scrollDown();
  }
  componentDidUpdate() {
    this.scrollDown();
  }
  scrollDown = () => {
    const { container } = this.refs;
    container.scrollTop = container.scrollHeight
  }

  render() {
    const { messages, user } = this.props;
    return (
      <div className='Messages' >
        <div className='Messages-log' ref='container'>
            {
              messages.map((msg, indx, arr) => (
                <div
                  key={msg._id}
                  className={`Messages-msg-conteiner ${msg.user.name === user.name ? 'right' : ''}`}
                >
                  <div className='data'>
                    <div className='msg'>{msg.text}</div>
                    <div className='time'>
                      {`${new Date(msg.createdAt).getHours()}:${('0' + new Date(msg.createdAt).getMinutes()).slice(-2)}`}
                    </div>
                  </div>
                    { arr[indx+1] && (msg.user.name === arr[indx+1].user.name)
                        ? null
                        : <div className='sender'>
                            {`${msg.user.name}`}
                          </div>
                    }

                </div>
              ))
            }

        </div>

      </div>
    )
  }
}
