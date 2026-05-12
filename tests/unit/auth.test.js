const jwt = require('jsonwebtoken');
const { protect, authorize } = require('../../middleware/auth');
const User = require('../../models/User');

jest.mock('jsonwebtoken');
jest.mock('../../models/User');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {
        authorization: 'Bearer validtoken'
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    process.env.JWT_SECRET = 'testsecret';
  });

  describe('protect middleware', () => {
    it('should call next if token is valid and user exists', async () => {
      jwt.verify.mockReturnValue({ id: 'user123' });
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: 'user123', role: 'STUDENT' })
      });

      await protect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user._id).toBe('user123');
    });

    it('should return 401 if no authorization header', async () => {
      req.headers.authorization = undefined;

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: expect.stringMatching(/Not authorized/) });
    });

    it('should return 401 if token verification fails', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('authorize middleware', () => {
    it('should call next if user has allowed role', () => {
      req.user = { role: 'REGISTRAR' };
      const middleware = authorize('REGISTRAR', 'DEAN');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 if user role is not allowed', () => {
      req.user = { role: 'STUDENT' };
      const middleware = authorize('REGISTRAR');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: expect.stringMatching(/not authorized/) });
    });

    it('should allow SUPER_ADMIN even if role not in list', () => {
      req.user = { role: 'SUPER_ADMIN' };
      const middleware = authorize('REGISTRAR');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
