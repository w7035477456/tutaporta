import { fn } from 'storybook/test';
import MyStorybookTable from '../views/dashboard/eClassifieds/MyStorybookTable';
import '../views/dashboard/eClassifieds/eClassifiedsStorybook.css';

const SAMPLE_LISTINGS = [
  {
    id: 'L-1001',
    title: 'Vintage road bike',
    category: 'Sports',
    price: 'Two Hundres dollars',
    city: 22003,
    seller: 'AlexRider'
  },
  {
    id: 'L-1002',
    title: 'Ikea desk + chair',
    category: 'Furniture',
    price: 75,
    city: 'Fairfax, VA',
    seller: 'NestNook'
  },
  {
    id: 'L-1003',
    title: 'iPhone 13 — unlocked',
    category: 'Electronics',
    price: 410,
    city: 'Bethesda, MD',
    seller: 'TechToby'
  },
  {
    id: 'L-1004',
    title: 'Concert tickets (2)',
    category: 'Tickets',
    price: 160,
    city: 'Washington, DC',
    seller: 'MelodyMae'
  }
];

export default {
  title: 'eClassifieds/MyStorybookTable',
  component: MyStorybookTable,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded'
  },
  args: {
    listings: SAMPLE_LISTINGS,
    busyId: '',
    onSubmitForReview: fn()
  }
};

/** Default demo — click Submit for review and watch the Actions panel. */
export const Default = {};

/** One row busy (Starting…). */
export const Submitting = {
  args: {
    busyId: 'L-1001'
  }
};

/** Empty table. */
export const Empty = {
  args: {
    listings: []
  }
};
