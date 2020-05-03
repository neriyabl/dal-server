import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {Message} from "./messsage.model";
import {User} from "./User.model";

const serviceAccount = require("./dal-project-firebase-adminsdk-z05li-20e7f645ab.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://dal-project.firebaseio.com"
});
const ref = admin.database().ref();

export const Messages = functions.https.onRequest(
  async (request, response) => {
    const messagesRef = ref.child('messages');
    if (request.method === 'GET') {
      const {username, friendName, fromDate} = request.query;
      const from = new Date(fromDate.replace(' ', '+'));
      const allMessagesObj = (await messagesRef.once('value')).val();
      if (!allMessagesObj) {
        response.send([]);
        return;
      }
      const relevantMessages = Object.keys(allMessagesObj)
        .map<Message>(key => (allMessagesObj[key]))
        .filter(message => {
          return (
            (
              (username === message.from && friendName === message.to) ||
              (username === message.to && friendName === message.from)) &&
            (new Date(message.date) > from)
          )
        })
        .sort((a, b) => (new Date(a.date).getTime() - new Date(b.date).getTime()));
      response.send(relevantMessages);
    } else if (request.method === 'POST') {
      const {content, from, to, date} = request.body;
      const message: Message = {
        date,
        content,
        from,
        to
      };
      await messagesRef.push(message);
      response.send(message);
    } else {
      response.send('we dont support this http method')
    }
  }
);

export const Users = functions.https.onRequest(
  async (request, response) => {
    const usersRef = ref.child('users');
    if (request.method === 'GET') {
      const allUsers = (await usersRef.once('value')).val();
      response.send(allUsers ? Object.keys(allUsers) : []);
    }
  }
);

export const UserDetails = functions.https.onRequest(
  async (request, response) => {
    const usersRef = ref.child('users');
    if (request.method === 'GET') {
      const {username} = request.query;
      try {
        const userNode = (await usersRef.child(username).once('value')).val();
        const user: User = {
          username,
          publicKey: userNode.publicKey,
          friends: userNode.friends
        };
        response.send(user);
      } catch (e) {
        response.send({})
      }
    } else if (request.method === 'POST') {
      const {username, publicKey} = request.body;
      const userExist = await usersRef.orderByKey().equalTo(username).once('value');
      if (userExist.exists()) {
        const {friends} = userExist.child(username).val();
        const user: User = {
          username,
          publicKey,
          friends: Object.keys(friends).map(key => ({name: key, symmetricKey: friends[key]}))
        };
        response.send(user);
        return;
      }
      const newUser = {
        publicKey,
        friends: []
      };
      await usersRef.child(username).set(newUser);
      response.send({username, ...newUser});
    } else if (request.method === 'PATCH') {
      const {username, userKey, friendName, friendKey} = request.body;
      console.log('get details:');
      console.log('\t' + username);
      console.log('\t' + userKey);
      console.log('\t' + friendName);
      console.log('\t' + friendKey);
      await usersRef.child(`${username}/friends/${friendName}`).set(userKey);
      await usersRef.child(`${friendName}/friends/${username}`).set(friendKey);
      response.send(`${username}: updated`);
    }
  }
);
