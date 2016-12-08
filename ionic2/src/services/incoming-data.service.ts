import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs/Rx';
import { Logger } from 'angular2-logger/core';

import { ScannerService } from './scanner.service';

import bwc from 'bitcore-wallet-client/index';

interface  IncomingDataType {
  type: string;
  parsedData: any;
}

@Injectable()
export class IncomingDataService {

  win: any = window;
  bitcore: any = bwc.Bitcore;

  actionSheetSubject: Subject<any> = new Subject<any>();
  actionSheetObservable: Observable<any> = this.actionSheetSubject.asObservable();

  payproService: any = {
    getPayProDetails: (url, callback) => {
      return callback('not paypro');
    }
  };

  constructor(
    public logger: Logger,
    public scannerService: ScannerService
  ) {
    this.win.appConfig = {
      name: 'appName'
    };
  }

  parseBip21(data) {
    let parsed = new this.bitcore.URI(data);
    let addr = parsed.address ? parsed.address.toString() : '';
    let amount = parsed.amount ? parsed.amount : '';
    let parsedData = {
      r: parsed.r,
      address: addr,
      amount: amount,
      message: parsed.message
    };
    return parsedData;
  }

  parseBitpayCardData(data) {
    let secret = this.getParameterByName('secret', data);
    let email = this.getParameterByName('email', data);
    let otp = this.getParameterByName('otp', data);
    let parsedData = {
      secret: secret,
      email: email,
      otp: otp
    };
    return parsedData;
  }

  getDataType(data: string): Promise<IncomingDataType> {
    return new Promise((resolve, reject) => {
      this.logger.debug('Processing incoming data: ' + data);
      // data extensions for Payment Protocol with non-backwards-compatible request
      if ((/^bitcoin:\?r=[\w+]/).exec(data)) {
        let parsedData = decodeURIComponent(data.replace('bitcoin:?r=', ''));
        return resolve({type: 'paypro', parsedData: parsedData});
      }
      data = this.sanitizeUri(data);

      // BIP21
      if (this.bitcore.URI.isValid(data)) {
        let parsedData = this.parseBip21(data);
        if (parsedData.r) {
          this.payproService.getPayProDetails(parsedData.r, function(err, details) {
            return resolve({type: 'paypro', parsedData: details});
          });
        } else {
          if (parsedData.amount) {
            return resolve({type: 'bitcoinAddressWithAmount', parsedData: parsedData});
          } else {
            return resolve({type: 'bitcoinAddress', parsedData: parsedData});
          }
        }
      // Plain URL
      } else if (/^https?:\/\//.test(data)) {
        this.payproService.getPayProDetails(data, function(err, details) {
          if(err) {
            return resolve({type: 'url', parsedData: data});
          }
          return resolve({type: 'paypro', parsedData: details});
        });
        // Plain Address
      } else if (this.bitcore.Address.isValid(data, 'livenet') || this.bitcore.Address.isValid(data, 'testnet')) {
        return resolve({type: 'bitcoinAddress', parsedData: data});
      } else if (data && data.indexOf(this.win.appConfig.name + '://glidera') === 0) {
        return resolve({type: 'glidera', parsedData: data});
      } else if (data && data.indexOf(this.win.appConfig.name + '://coinbase') === 0) {
        return resolve({type: 'coinbase', parsedData: data});
        // BitPayCard Authentication
      } else if (data && data.indexOf(this.win.appConfig.name + '://') === 0) {
        let parsedData = this.parseBitpayCardData(data);
        return resolve({type: 'bitpayCard', parsedData: parsedData});
      // Join
      } else if (data && data.match(/^copay:[0-9A-HJ-NP-Za-km-z]{70,80}$/)) {
        return resolve({type: 'join', parsedData: data});
      // Old join
      } else if (data && data.match(/^[0-9A-HJ-NP-Za-km-z]{70,80}$/)) {
        return resolve({type: 'oldJoin', parsedData: data});
      } else {
        return resolve({type: 'text', parsedData: data});
      }
    });
  }

  showMenu (data: IncomingDataType) {
    this.actionSheetSubject.next({action: 'show', data: data});
  }

  menuHidden () {
    this.actionSheetSubject.next({action: 'hide'});
  }

  redir(data) {
    // this.logger.debug('Processing incoming data: ' + data);
    //
    // // data extensions for Payment Protocol with non-backwards-compatible request
    // if ((/^bitcoin:\?r=[\w+]/).exec(data)) {
    //   data = decodeURIComponent(data.replace('bitcoin:?r=', ''));
    //   // $state.go('tabs.send', {}, {'reload': true, 'notify': $state.current.name == 'tabs.send' ? false : true}).then(function() {
    //   //   $state.transitionTo('tabs.send.confirm', {paypro: data});
    //   // });
    //   return true;
    // }
    //
    // data = this.sanitizeUri(data);
    //
    // // BIP21
    // if (this.bitcore.URI.isValid(data)) {
    //   let parsed = new this.bitcore.URI(data);
    //
    //   //let addr = parsed.address ? parsed.address.toString() : '';
    //   //let message = parsed.message;
    //
    //   let amount = parsed.amount ?  parsed.amount : '';
    //
    //   if (parsed.r) {
    //     this.payproService.getPayProDetails(parsed.r, function(err, details) {
    //       this.handlePayPro(details);
    //     });
    //   } else {
    //     //$state.go('tabs.send', {}, {'reload': true, 'notify': $state.current.name == 'tabs.send' ? false : true});
    //     // Timeout is required to enable the "Back" button
    //     setTimeout(function() {
    //       if (amount) {
    //         //$state.transitionTo('tabs.send.confirm', {toAmount: amount, toAddress: addr, description:message});
    //       } else {
    //         //$state.transitionTo('tabs.send.amount', {toAddress: addr});
    //       }
    //     }, 100);
    //   }
    //   return true;
    //
    // // Plain URL
    // } else if (/^https?:\/\//.test(data)) {
    //
    //   this.payproService.getPayProDetails(data, function(err, details) {
    //     if(err) {
    //       this.showMenu({data: data, type: 'url'});
    //       return;
    //     }
    //     this.handlePayPro(details);
    //     return true;
    //   });
    //   // Plain Address
    // } else if (this.bitcore.Address.isValid(data, 'livenet') || this.bitcore.Address.isValid(data, 'testnet')) {
    //   //if($state.includes('tabs.scan')) {
    //     this.showMenu({data: data, type: 'bitcoinAddress'});
    //   // } else {
    //   //   this.goToAmountPage(data);
    //   // }
    // } else if (data && data.indexOf(this.win.appConfig.name + '://glidera') === 0) {
    //     //return $state.go('uriglidera', {url: data});
    // } else if (data && data.indexOf(this.win.appConfig.name + '://coinbase') === 0) {
    //     //return $state.go('uricoinbase', {url: data});
    //
    //   // BitPayCard Authentication
    // } else if (data && data.indexOf(this.win.appConfig.name + '://') === 0) {
    //     //let secret = this.getParameterByName('secret', data);
    //     //let email = this.getParameterByName('email', data);
    //     //let otp = this.getParameterByName('otp', data);
    //     // $state.go('tabs.home', {}, {'reload': true, 'notify': $state.current.name == 'tabs.home' ? false : true}).then(function() {
    //     //   $state.transitionTo('tabs.bitpayCardIntro', {
    //     //     secret: secret,
    //     //     email: email,
    //     //     otp: otp
    //     //   });
    //     // });
    //     return true;
    //
    // // Join
    // } else if (data && data.match(/^copay:[0-9A-HJ-NP-Za-km-z]{70,80}$/)) {
    //   // $state.go('tabs.home', {}, {'reload': true, 'notify': $state.current.name == 'tabs.home' ? false : true}).then(function() {
    //   //   $state.transitionTo('tabs.add.join', {url: data});
    //   // });
    //   return true;
    //
    // // Old join
    // } else if (data && data.match(/^[0-9A-HJ-NP-Za-km-z]{70,80}$/)) {
    //   // $state.go('tabs.home', {}, {'reload': true, 'notify': $state.current.name == 'tabs.home' ? false : true}).then(function() {
    //   //   $state.transitionTo('tabs.add.join', {url: data});
    //   // });
    //   return true;
    // } else {
    //
    //   //if($state.includes('tabs.scan')) {
    //     this.showMenu({data: data, type: 'text'});
    //   //}
    // }
    //
    // return false;

  }

  sanitizeUri(data) {
    // Fixes when a region uses comma to separate decimals
    let regex = /[\?\&]amount=(\d+([\,\.]\d+)?)/i;
    let match = regex.exec(data);
    if (!match || match.length === 0) {
      return data;
    }
    let value = match[0].replace(',', '.');
    let newUri = data.replace(regex, value);

    // mobile devices, uris like copay://glidera
    newUri.replace('://', ':');

    return newUri;
  }

  getParameterByName(name, url) {
    if (!url) return;
    name = name.replace(/[\[\]]/g, "\\$&");
    let regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
    results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  }

  goToAmountPage(toAddress) {
    //$state.go('tabs.send', {}, {'reload': true, 'notify': $state.current.name == 'tabs.send' ? false : true});
    setTimeout(function() {
      //$state.transitionTo('tabs.send.amount', {toAddress: toAddress});
    }, 100);
  }

  handlePayPro(payProDetails){
    // let stateParams = {
    //   toAmount: payProDetails.amount,
    //   toAddress: payProDetails.toAddress,
    //   description: payProDetails.memo,
    //   paypro: payProDetails
    // };
    this.scannerService.pausePreview();
    // $state.go('tabs.send', {}, {'reload': true, 'notify': $state.current.name == 'tabs.send' ? false : true}).then(function() {
    //   setTimeout(function() {
    //     $state.transitionTo('tabs.send.confirm', stateParams);
    //   });
    // });
  }

}
