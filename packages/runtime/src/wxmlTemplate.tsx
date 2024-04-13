import React from 'react';
import { wmrt } from './wmrt';

export function wxmlTemplate(ConnectComponent: any) {
  return (props: any) => {
    // class BaseComponent extends ConnectComponent {
    //   public callEvent = (eventName: string, event: any) => {
    //     if (this.props.callEvent) {
    //       this.props.callEvent(eventName, event);
    //     }
    //   };
    // }
    return <ConnectComponent {...props} wmrt={wmrt} __isTemplate={true} />;
  };
}
