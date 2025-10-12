// Mock Prisma client for testing when real Prisma can't be generated
// Simple in-memory storage for the session
const mockStorage = {
  offers: new Map(),
  orders: new Map(),
  messages: new Map(),
  users: new Map(),
};

export const mockPrisma = {
  order: {
    findMany: async (options?: any) => {
      console.log('[MOCK] order.findMany called with:', options);
      return Array.from(mockStorage.orders.values());
    },
    findFirst: async (options?: any) => {
      console.log('[MOCK] order.findFirst called with:', options);
      const orders = Array.from(mockStorage.orders.values());
      return orders.find(order => {
        if (options?.where?.offerId && order.offerId !== options.where.offerId) return false;
        if (options?.where?.status && order.status !== options.where.status) return false;
        return true;
      }) || null;
    },
    create: async (options?: any) => {
      console.log('[MOCK] order.create called with:', options);
      const mockOrder = {
        id: 'mock-order-' + Date.now(),
        title: options?.data?.title || 'Mock Order',
        makerAddress: options?.data?.makerAddress || '',
        priceTON: options?.data?.priceTON || 0,
        nPercent: options?.data?.nPercent || 1,
        makerDeposit: options?.data?.makerDeposit || 0,
        takerStake: options?.data?.takerStake || 0,
        offerId: options?.data?.offerId || null,
        status: 'created',
        createdAt: new Date().toISOString(),
      };
      mockStorage.orders.set(mockOrder.id, mockOrder);
      return mockOrder;
    },
  },
  message: {
    findMany: async (options?: any) => {
      console.log('[MOCK] message.findMany called with:', options);
      const messages = Array.from(mockStorage.messages.values());
      return messages.filter(message => 
        !options?.where?.orderId || message.orderId === options.where.orderId
      );
    },
    create: async (options?: any) => {
      console.log('[MOCK] message.create called with:', options);
      const mockMessage = {
        id: 'mock-message-' + Date.now(),
        orderId: options?.data?.orderId || '',
        sender: options?.data?.sender || '',
        text: options?.data?.text || '',
        createdAt: new Date().toISOString(),
      };
      mockStorage.messages.set(mockMessage.id, mockMessage);
      return mockMessage;
    },
  },
  offer: {
    findMany: async (options?: any) => {
      console.log('[MOCK] offer.findMany called with:', options);
      return Array.from(mockStorage.offers.values());
    },
    findUnique: async (options?: any) => {
      console.log('[MOCK] offer.findUnique called with:', options);
      const offer = mockStorage.offers.get(options?.where?.id);
      if (!offer) return null;
      
      // Simulate the creator relationship by adding makerAddress
      const enrichedOffer = {
        ...offer,
        makerAddress: 'mock-maker-address-' + offer.id.split('-').pop(),
      };
      
      // Return only selected fields if specified
      if (options?.select) {
        const selected: any = {};
        Object.keys(options.select).forEach(key => {
          if (options.select[key] && key in enrichedOffer) {
            selected[key] = enrichedOffer[key as keyof typeof enrichedOffer];
          }
        });
        return selected;
      }
      
      return enrichedOffer;
    },
    create: async (options?: any) => {
      console.log('[MOCK] offer.create called with:', options);
      const mockOffer = {
        id: 'mock-offer-' + Date.now(),
        title: options?.data?.title || 'Mock Offer',
        description: options?.data?.description || '',
        budgetTON: options?.data?.budgetTON || 0,
        status: options?.data?.status || 'open',
        createdAt: new Date().toISOString(),
      };
      mockStorage.offers.set(mockOffer.id, mockOffer);
      
      // Return only selected fields if specified
      if (options?.select) {
        const selected: any = {};
        Object.keys(options.select).forEach(key => {
          if (options.select[key] && key in mockOffer) {
            selected[key] = mockOffer[key as keyof typeof mockOffer];
          }
        });
        return selected;
      }
      
      return mockOffer;
    },
  },
  user: {
    findUnique: async (options?: any) => {
      console.log('[MOCK] user.findUnique called with:', options);
      const user = mockStorage.users.get(options?.where?.address || options?.where?.id);
      return user || null;
    },
    upsert: async (options?: any) => {
      console.log('[MOCK] user.upsert called with:', options);
      const address = options?.where?.address;
      const existing = mockStorage.users.get(address);
      
      if (existing) {
        // Update
        const updated = { ...existing, ...options?.update };
        mockStorage.users.set(address, updated);
        return updated;
      } else {
        // Create
        const mockUser = {
          id: 'mock-user-' + Date.now(),
          address: address || '',
          nickname: address || '',
          createdAt: new Date().toISOString(),
          ...options?.create,
        };
        mockStorage.users.set(address, mockUser);
        return mockUser;
      }
    },
  },
};