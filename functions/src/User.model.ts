export class User {
  username!: string;
  publicKey!: any;
  friends: Friend[] = [];
}

class Friend {
  name!: string;
  symmetricKey!: any;
}
