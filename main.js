const {app, Menu, Tray, BrowserWindow, Screen, ipcMain } = require('electron')

const path = require('path')
const url = require('url')

const steem = require('steem');
// custom node notifier
const notification = require('./lib/node-notifier/index.js');
const open = require("open");

let username;

ipcMain.on('new-username', (event, data) => {
  console.log('username set', data)
  username = data
})


let tray;
let appView = null;

function appReady() {
    tray = new Tray('./steem-icon.png')
    tray.setToolTip('steem-notifier-v-0-1')
    tray.on('click', () => {
      if (appView === null){
        createWindow();
      } else {
        openWindow(appView);
      }
    })
}

function createWindow() {
  let trayPosition = tray.getBounds()

  appView = new BrowserWindow({
    width: 300,
    height: 150,
    frame: true,
    show: false,
    resizable: false,
    x: trayPosition.x - 150,
    y: trayPosition.y + 35
  })

  appView.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))
  openWindow(appView)
}

function openWindow(appWindow) {
  appWindow.show()
}

app.on('ready', appReady)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  appView = null
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

steem.api.streamBlockNumber((err, blockNum) => {
    steem.api.getOpsInBlock(blockNum, false, (err, opperations) =>{
        opperations.forEach( (tx, i, arr) => {

          let transaction = tx.op[0]

          if(transaction == 'comment') {
            let commentBody = tx.op[1].body;
            let mentionUsername = '@'+username;
            let includesMention = commentBody.includes(mentionUsername);
            transaction = includesMention ? 'mention' : 'comment'
          }

          switch(true){
            case (transaction == 'comment' && tx.op[1].parent_author == username):
                sendNotification({
                  nType: 'comment',
                  author: tx.op[1].parent_author,
                  body : tx.op[1].body,
                  link : `https://steemit.com/@${tx.op[1].parent_author }/${tx.op[1].permlink}/`
                })
            break;
            case (transaction == 'transfer' && tx.op[1].to == username ):
                sendNotification({
                  nType: 'transfer',
                  from: tx.op[1].from,
                  amount : tx.op[1].amount,
                  link : `https://steemit.com/@${username}/transfers`
                })
            break;
            case (transaction == 'vote' && tx.op[1].author == username):
                sendNotification({
                  nType: 'vote',
                  from: tx.op[1].voter,
                  weight :  tx.op[1].weight ? tx.op[1].weight : 10000
                  link : `https://steemit.com/@${tx.op[1].author }/${tx.op[1].permlink}/`
                })
            break;
            case (transaction == 'author_reward' tx.op[1].author == username ):
                sendNotification({
                  nType: 'Author Reward',
                  sbd:  tx.op[1].sbd_payout,
                  vests: tx.op[1].vesting_payout,
                  steem: tx.op[1].steem_payout,
                  link : `https://steemit.com/@${tx.op[1].author }/${tx.op[1].permlink}/`
                })
            break;
            case (transaction == 'comment_reward' || tx.op[1].author == username ):
                sendNotification({
                  nType: 'Comment Reward',
                  sbd:  tx.op[1].sbd_payout,
                  vests: tx.op[1].vesting_payout,
                  steem: tx.op[1].steem_payout,
                  link : `https://steemit.com/@${tx.op[1].author }/${tx.op[1].permlink}/`
                })
            break;
            case (transaction == 'mention'):
                sendNotification({
                  nType: 'mention',
                  from: tx.op[1].parent_author,
                  link : `https://steemit.com/@${tx.op[1].author }/${tx.op[1].permlink}/`
                })
            break;
            default:
            }
        })
    })
});

function sendNotification(data) {
  let message;
  switch(data.nType){
    case 'comment':
      message = `${data.author} : ${data.body.substring(0,20)}...`
    break;
    case 'transfer':
      message = `${data.from} : Sent you ${data.amount}`
    break;
    case 'vote':
      message = `${data.from} : voted ${data.weight/100}%`
    break;
    case 'mention':
      message = `${data.from} mentioned you...`
    break;
    case 'Author Reward':
      message = `Author Reward: ${data.sbd}`
    break;
    case 'Comment Reward':
      message = `Comment Reward: ${data.sbd}`
    break;
    default:
    message = `New notification`

  }

  notification.notify({
      title: `New Steem ${data.nType}!`,
      message: message,
      closeLabel: 'Close',
      timeout: 20,
      icon: './steem-icon-large.png',
      actions: 'View',
      open: data.link
   });

   notification.on('click', function (notifierObject, options) {
     open(data.link)
   });
}
