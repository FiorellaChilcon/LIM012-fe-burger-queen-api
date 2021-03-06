// npx jest -t getUsers
const mongoose = require('mongoose');
const User = require('../../database/user-schema');

const {
  getUsers,
  getOneUser,
  addUser,
  deleteUser,
  updateUser,
} = require('../users');
const { resp, next } = require('./mock-express');
const { connectToDB } = require('../../database/db-connect');

// DATA
const userAddedReq = {
  body: {
    email: 'test@localhost',
    password: 'changeme',
    roles: {
      admin: false,
    },
  },
};
const failedReq = {
  body: {
    email: 'error@localhost',
  },
  params: {
    uid: 'error@localhost',
  },
};
const userData = {
  email: 'test2@localhost',
  password: '123455',
  roles: {
    admin: true,
  },
};
describe('Users', () => {
  beforeAll((done) => {
    connectToDB(process.env.MONGO_URL);
    mongoose.connection.on('connected', async () => {
      const req = {
        body: userData,
      };
      await addUser(req, resp, next);
      done();
    });
  });
  it('should add a user to the colection', async () => {
    const result = await addUser(userAddedReq, resp, next);
    expect(result.email).toBe('test@localhost');
    expect(result.password).toBeUndefined();
    expect(result.roles.admin).toBeFalsy();
  });
  it('should not add a user that already exists with the email', async () => {
    const result = await addUser(userAddedReq, resp, next);
    expect(result).toBe(403);
  });
  it('should not add a user to the colection when password is missing', async () => {
    const result = await addUser(failedReq, resp, next);
    expect(result).toBe(400);
  });
  it('should not add a user to the colection when the email is not valid', async () => {
    const req = {
      body: {
        email: 'localhost',
        password: '123456',
      },
    };
    const result = await addUser(req, resp, next);
    expect(result).toBe(400);
  });
  it('should not add a user to the colection when the password is weak', async () => {
    const req = {
      body: {
        email: 'localhost@localhost',
        password: '123',
      },
    };
    const result = await addUser(req, resp, next);
    expect(result).toBe(400);
  });
  it('should get users collection', async () => {
    const req = {
      query: {
        page: 1,
        limit: 1,
      },
    };
    delete userData.password;
    const result = await getUsers(req, resp, next);
    delete result[0]._doc._id;
    delete result[0]._doc.__v;
    expect(result[0]._doc).toEqual(userData);
  });
  it('should get user requested with email: test2@localhost', async () => {
    const req = {
      params: {
        uid: 'test2@localhost',
      },
    };
    const result = await getOneUser(req, resp, next);
    delete result._doc._id;
    delete result._doc.__v;
    expect(result._doc).toEqual(userData);
  });
  it('should not get user requested with email: unknown@localhost and return 404', async () => {
    const req = {
      params: {
        uid: 'unknown@localhost',
      },
    };
    const result = await getOneUser(req, resp, next);
    expect(result).toBe(404);
  });
  it('should not edit the user password when the new value is weak', async () => {
    delete userAddedReq.body.password;
    const req = {
      body: {
        email: 'test@localhost',
        password: 'wow',
      },
      params: { uid: 'test@localhost' },
      headers: {
        user: userAddedReq.body,
      },
    };
    const result = await updateUser(req, resp, next);
    expect(result).toBe(400);
  });
  it('should not edit the user email when is not a valid one', async () => {
    const req = {
      body: {
        email: 'wrongFormatLocalhost',
      },
      params: { uid: 'test@localhost' },
      headers: {
        user: userAddedReq.body,
      },
    };
    const result = await updateUser(req, resp, next);
    expect(result).toBe(400);
  });
  it('should not be able to edit roles field when the user is not an admin', async () => {
    const req = {
      body: {
        password: 'changeme',
        roles: {
          admin: true,
        },
      },
      params: { uid: 'test@localhost' },
      headers: {
        user: {
          roles: {
            admin: false,
          },
        },
      },
    };
    const result = await updateUser(req, resp, next);
    expect(result).toBe(403);
  });
  it('should not be able to edit when there is not email and password present in the body', async () => {
    const req = {
      body: {},
      params: { uid: 'test@localhost' },
      headers: {
        user: {},
      },
    };
    const result = await updateUser(req, resp, next);
    expect(result).toBe(400);
  });
  it('should edit the user email', async () => {
    const req = {
      body: {
        email: 'newtest@localhost',
      },
      params: { uid: 'test@localhost' },
      headers: {
        user: userAddedReq.body,
      },
    };
    const result = await updateUser(req, resp, next);
    expect(result.email).toBe('newtest@localhost');
  });
  it('should edit the user roles', async () => {
    const req = {
      body: {
        email: 'newtest@localhost',
        password: 'newPassword',
        roles: {
          admin: false,
        },
      },
      params: { uid: 'newtest@localhost' },
      headers: {
        user: {
          email: 'newtest@localhost',
          roles: {
            admin: true,
          },
        },
      },
    };
    const result = await updateUser(req, resp, next);
    expect(result.roles.admin).toBeFalsy();
  });
  it('should delete user requested with email: test2@localhost', async () => {
    const req = {
      params: { uid: 'test2@localhost' },
    };
    const result = await deleteUser(req, resp, next);
    const userExists = await User.findOne({ email: req.params.uid });
    delete result._doc._id;
    delete result._doc.__v;
    expect(result._doc).toEqual(userData);
    expect(userExists).toBeNull();
  });
  it('should not update or delete the user when is not found', async () => {
    const result1 = await deleteUser(failedReq, resp, next);
    const result2 = await updateUser(failedReq, resp, next);
    expect(result1).toBe(404);
    expect(result2).toBe(404);
  });
  afterAll(async () => {
    await mongoose.connection.close();
  });
});
