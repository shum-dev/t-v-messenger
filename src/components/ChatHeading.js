import React from 'react';
import { Breadcrumb, BreadcrumbItem } from 'reactstrap';

import '../styles/ChatHeading.css'

export default function({activeChat, user}) {
  return (
    <div className='ChatHeading'>
      <div className='ChatHeading-info'>
        <h3 className='ChatHeading-name'>
          {activeChat.name}
        </h3>
        <div className='ChatHeading-breadcrumb'>
          <Breadcrumb>
            {
              activeChat.users.map(item => (
                  <BreadcrumbItem
                    key={item._id}
                    active={item.name === user ? true : false}
                    >{item.name}</BreadcrumbItem>
              ))
            }
          </Breadcrumb>
        </div>
      </div>
    </div>
  )
}