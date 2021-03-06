const Order = require('../database/order-schema');
const Product = require('../database/product-schema');
const { paginate } = require('./pagination');

const getActualProduct = (products) => Promise.all(products.map(async (product) => {
  const { productId, qty } = product;
  const { name, price, _id } = await Product.findById(productId);
  const result = {
    product: {
      _id,
      name,
      price,
    },
    qty,
  };
  return result;
}));

const getTotal = (arr) => {
  const listOfPrices = arr.map((e) => e.product.price * e.qty);
  return listOfPrices.reduce((a, c) => a + c);
};

module.exports = {
  getOrders: (req, resp, next) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    return Order.paginate({}, { sort: 'dateEntry', page, limit }, (err, orders) => {
      if (err) {
        return next(500);
      }
      const pagination = paginate(req, page, limit, orders);
      if (pagination) {
        resp.setHeader('link', pagination);
      }
      return resp.status(200).json(orders.docs);
    });
  },
  getOneOrder: async (req, resp, next) => {
    const { orderId } = req.params;
    try {
      const doc = await Order.findOne({ _id: orderId });
      if (!doc) {
        throw new Error('Not Found');
      }
      return resp.status(200).json(doc);
    } catch (e) {
      return next(404);
    }
  },
  addOrder: async (req, resp, next) => {
    const {
      userId, products, total,
    } = req.body;
    if (!userId || !products) {
      return next(400);
    }
    if (!Array.isArray(products)) {
      return next(400);
    }
    const listOfProducts = await getActualProduct(products);
    req.body.products = listOfProducts;
    if (!total) {
      req.body.total = getTotal(listOfProducts);
    }
    const order = new Order(req.body);
    order.validateSync();
    try {
      const doc = await order.save();
      return resp.status(200).json(doc);
    } catch (e) {
      return next(400);
    }
  },
  updateOrder: async (req, resp, next) => {
    if (Object.keys(req.body).length === 0) {
      return next(400);
    }
    const { orderId } = req.params;
    const { status, products, total } = req.body;
    if (status && status === 'delivered') {
      req.body.dateProcessed = Date.now();
    }
    try {
      if (products) {
        const actualOrder = await Order.findById({ _id: orderId });
        if (!actualOrder) {
          throw new Error('Not Found');
        }
        const actualProducts = actualOrder.products.filter((element) => {
          if (products.some((e) => String(e.productId) === String(element.product._id))) {
            // eslint-disable-next-line no-param-reassign
            element.qty = products.find((e) => (
              String(e.productId) === String(element.product._id))).qty;
          }
          if (element.qty === 0) { return false; }
          return true;
        });
        const newProducts = products.filter((element) => (
          !actualOrder.products.some((e) => String(e.product._id) === String(element.productId))
        ));
        const listOfProducts = actualProducts.concat(await getActualProduct(newProducts));
        req.body.products = listOfProducts;
        if (!total) {
          req.body.total = getTotal(listOfProducts);
        }
      }
      const doc = await Order.findOneAndUpdate({ _id: orderId }, req.body, {
        new: true,
        runValidators: true,
        useFindAndModify: false,
        context: 'query',
      });
      if (!doc) {
        throw new Error('Not Found');
      }
      return resp.status(200).json(doc);
    } catch (e) {
      if (e.message === 'Not Found' || e.kind === 'ObjectId') {
        return next(404);
      }
      return next(400);
    }
  },
  deleteOrder: async (req, resp, next) => {
    try {
      const doc = await Order.findOneAndDelete({ _id: req.params.orderId });
      if (!doc) {
        throw new Error('Not Found');
      }
      return resp.status(200).json(doc);
    } catch (e) {
      return next(404);
    }
  },
};
