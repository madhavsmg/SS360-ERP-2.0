import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  formatPaymentTerms,
  normalizeIndianMobile,
  sanitizeGstinInput,
  validateOptionalGstin,
  validateOptionalIndianMobile,
  validatePaymentTermDays,
} from '../utils/businessValidation';
import { numberValue, presentNumber, roundMoney } from '../utils/erpNumbers';
import { calculateSaleRevenue } from '../utils/salesCalculations';

const STORAGE_KEY = 'ss360.enterpriseData.v1';

const today = new Date().toISOString().slice(0, 10);
const LEGACY_STOCK_INTAKE_KEYS = {
  lineDocumentId: 'purchase' + 'OrderId',
  invoiceDocumentIds: 'purchase' + 'OrderIds',
};

const customerStateByCity = new Map(
  [
    ['Hyderabad', 'Telangana'],
    ['Secunderabad', 'Telangana'],
    ['Warangal', 'Telangana'],
    ['Karimnagar', 'Telangana'],
    ['Khammam', 'Telangana'],
    ['Nizamabad', 'Telangana'],
    ['Nalgonda', 'Telangana'],
    ['Mahbubnagar', 'Telangana'],
    ['Suryapet', 'Telangana'],
    ['Adilabad', 'Telangana'],
    ['Mancherial', 'Telangana'],
    ['Ramagundam', 'Telangana'],
    ['Hanamkonda', 'Telangana'],
    ['Siddipet', 'Telangana'],
    ['Medak', 'Telangana'],
    ['Sangareddy', 'Telangana'],
    ['Jagtial', 'Telangana'],
    ['Kamareddy', 'Telangana'],
    ['Miryalaguda', 'Telangana'],
    ['Bhongir', 'Telangana'],
    ['Visakhapatnam', 'Andhra Pradesh'],
    ['Vijayawada', 'Andhra Pradesh'],
    ['Guntur', 'Andhra Pradesh'],
    ['Nellore', 'Andhra Pradesh'],
    ['Tirupati', 'Andhra Pradesh'],
    ['Kurnool', 'Andhra Pradesh'],
    ['Kakinada', 'Andhra Pradesh'],
    ['Rajahmundry', 'Andhra Pradesh'],
    ['Kadapa', 'Andhra Pradesh'],
    ['Anantapur', 'Andhra Pradesh'],
    ['Ongole', 'Andhra Pradesh'],
    ['Vizianagaram', 'Andhra Pradesh'],
    ['Eluru', 'Andhra Pradesh'],
    ['Proddatur', 'Andhra Pradesh'],
    ['Nandyal', 'Andhra Pradesh'],
    ['Adoni', 'Andhra Pradesh'],
    ['Madanapalle', 'Andhra Pradesh'],
    ['Machilipatnam', 'Andhra Pradesh'],
    ['Tenali', 'Andhra Pradesh'],
    ['Chittoor', 'Andhra Pradesh'],
    ['Hindupur', 'Andhra Pradesh'],
    ['Srikakulam', 'Andhra Pradesh'],
    ['Bhimavaram', 'Andhra Pradesh'],
    ['Tadepalligudem', 'Andhra Pradesh'],
    ['Rajam', 'Andhra Pradesh'],
    ['Bobbili', 'Andhra Pradesh'],
    ['Parvathipuram', 'Andhra Pradesh'],
    ['Salur', 'Andhra Pradesh'],
    ['Palasa', 'Andhra Pradesh'],
    ['Tekkali', 'Andhra Pradesh'],
    ['Amalapuram', 'Andhra Pradesh'],
    ['Mandapeta', 'Andhra Pradesh'],
    ['Ravulapalem', 'Andhra Pradesh'],
    ['Tuni', 'Andhra Pradesh'],
    ['Anakapalli', 'Andhra Pradesh'],
    ['Narsipatnam', 'Andhra Pradesh'],
    ['Pithapuram', 'Andhra Pradesh'],
    ['Samalkot', 'Andhra Pradesh'],
    ['Gudivada', 'Andhra Pradesh'],
    ['Nuzvid', 'Andhra Pradesh'],
    ['Repalle', 'Andhra Pradesh'],
    ['Chirala', 'Andhra Pradesh'],
    ['Markapur', 'Andhra Pradesh'],
    ['Kandukur', 'Andhra Pradesh'],
    ['Rayachoti', 'Andhra Pradesh'],
    ['Jammalamadugu', 'Andhra Pradesh'],
    ['Tadipatri', 'Andhra Pradesh'],
    ['Guntakal', 'Andhra Pradesh'],
    ['Dharmavaram', 'Andhra Pradesh'],
    ['Puttaparthi', 'Andhra Pradesh'],
    ['Kavali', 'Andhra Pradesh'],
    ['Gudur', 'Andhra Pradesh'],
    ['Sullurupeta', 'Andhra Pradesh'],
    ['Venkatagiri', 'Andhra Pradesh'],
    ['Puttur', 'Andhra Pradesh'],
    ['Nagari', 'Andhra Pradesh'],
    ['Palamaner', 'Andhra Pradesh'],
  ].map(([city, state]) => [city.toLowerCase(), state])
);

const customerMasterImport = [
  {
    id: 'CUS-SRI-LAKSHMI-KIRANA-STORES',
    name: 'Sri Lakshmi Kirana Stores',
    type: 'Retail',
    phone: '9876502101',
    city: 'Hyderabad',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 50000,
    outstanding: 0,
  },
  {
    id: 'CUS-GANESH-GENERAL-STORES',
    name: 'Ganesh General Stores',
    type: 'Retail',
    phone: '9876502102',
    city: 'Secunderabad',
    deliveryPreference: 'Auto Transport',
    creditLimit: 45000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-SAI-BALAJI-PROVISIONS',
    name: 'Sri Sai Balaji Provisions',
    type: 'Wholesale',
    phone: '9876502103',
    city: 'Warangal',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 75000,
    outstanding: 0,
  },
  {
    id: 'CUS-VENKATESWARA-TEA-STALL',
    name: 'Venkateswara Tea Stall',
    type: 'Hotel',
    phone: '9876502104',
    city: 'Karimnagar',
    deliveryPreference: 'APSRTC Bus Parcel',
    creditLimit: 25000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-DURGA-TIFFIN-CENTER',
    name: 'Sri Durga Tiffin Center',
    type: 'Hotel',
    phone: '9876502105',
    city: 'Khammam',
    deliveryPreference: 'SBT Transport',
    creditLimit: 30000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRINIVASA-GROCERY-MART',
    name: 'Srinivasa Grocery Mart',
    type: 'Retail',
    phone: '9876502106',
    city: 'Nizamabad',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 40000,
    outstanding: 0,
  },
  {
    id: 'CUS-LAKSHMI-NARASIMHA-GENERAL-STORES',
    name: 'Lakshmi Narasimha General Stores',
    type: 'Retail',
    phone: '9876502107',
    city: 'Nalgonda',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-RAGHAVENDRA-KIRANA-COOL-DRINKS',
    name: 'Raghavendra Kirana & Cool Drinks',
    type: 'Retail',
    phone: '9876502108',
    city: 'Mahbubnagar',
    deliveryPreference: 'Auto Transport',
    creditLimit: 30000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-MANIKANTA-TEA-POINT',
    name: 'Sri Manikanta Tea Point',
    type: 'Hotel',
    phone: '9876502109',
    city: 'Suryapet',
    deliveryPreference: 'APSRTC Bus Parcel',
    creditLimit: 20000,
    outstanding: 0,
  },
  {
    id: 'CUS-PADMAVATHI-PROVISIONS',
    name: 'Padmavathi Provisions',
    type: 'Retail',
    phone: '9876502110',
    city: 'Adilabad',
    deliveryPreference: 'VRL Logistics',
    creditLimit: 45000,
    outstanding: 0,
  },
  {
    id: 'CUS-SAI-GANESH-MINI-MART',
    name: 'Sai Ganesh Mini Mart',
    type: 'Retail',
    phone: '9876502111',
    city: 'Mancherial',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-BALAJI-WHOLESALE-TRADERS',
    name: 'Sri Balaji Wholesale Traders',
    type: 'Wholesale',
    phone: '9876502112',
    city: 'Ramagundam',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 90000,
    outstanding: 0,
  },
  {
    id: 'CUS-KAKATIYA-GENERAL-STORES',
    name: 'Kakatiya General Stores',
    type: 'Retail',
    phone: '9876502113',
    city: 'Hanamkonda',
    deliveryPreference: 'SBT Transport',
    creditLimit: 40000,
    outstanding: 0,
  },
  {
    id: 'CUS-MALLIKARJUNA-TEA-STALL',
    name: 'Mallikarjuna Tea Stall',
    type: 'Hotel',
    phone: '9876502114',
    city: 'Siddipet',
    deliveryPreference: 'Auto Transport',
    creditLimit: 25000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-VENKATA-SAI-KIRANA',
    name: 'Sri Venkata Sai Kirana',
    type: 'Retail',
    phone: '9876502115',
    city: 'Medak',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-JAI-BHAVANI-PROVISIONS',
    name: 'Jai Bhavani Provisions',
    type: 'Retail',
    phone: '9876502116',
    city: 'Sangareddy',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 40000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-ANJANEYA-GENERAL-STORES',
    name: 'Sri Anjaneya General Stores',
    type: 'Retail',
    phone: '9876502117',
    city: 'Jagtial',
    deliveryPreference: 'APSRTC Bus Parcel',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-BALAJI-TIFFIN-MEALS',
    name: 'Balaji Tiffin & Meals',
    type: 'Hotel',
    phone: '9876502118',
    city: 'Kamareddy',
    deliveryPreference: 'SBT Transport',
    creditLimit: 30000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-RAMAKRISHNA-KIRANA-STORES',
    name: 'Sri Ramakrishna Kirana Stores',
    type: 'Retail',
    phone: '9876502119',
    city: 'Miryalaguda',
    deliveryPreference: 'Auto Transport',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-SAI-TRADERS',
    name: 'Sri Sai Traders',
    type: 'Wholesale',
    phone: '9876502120',
    city: 'Bhongir',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 70000,
    outstanding: 0,
  },
  {
    id: 'CUS-VIJAYA-LAKSHMI-GENERAL-STORES',
    name: 'Vijaya Lakshmi General Stores',
    type: 'Retail',
    phone: '9876502121',
    city: 'Visakhapatnam',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 50000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-KANAKA-DURGA-PROVISIONS',
    name: 'Sri Kanaka Durga Provisions',
    type: 'Retail',
    phone: '9876502122',
    city: 'Vijayawada',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 55000,
    outstanding: 0,
  },
  {
    id: 'CUS-VENKATESWARA-WHOLESALE-STORES',
    name: 'Venkateswara Wholesale Stores',
    type: 'Wholesale',
    phone: '9876502123',
    city: 'Guntur',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 85000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-LAKSHMI-NARAYANA-KIRANA',
    name: 'Sri Lakshmi Narayana Kirana',
    type: 'Retail',
    phone: '9876502124',
    city: 'Nellore',
    deliveryPreference: 'SBT Transport',
    creditLimit: 45000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-PADMAVATHI-TEA-SNACKS',
    name: 'Sri Padmavathi Tea & Snacks',
    type: 'Hotel',
    phone: '9876502125',
    city: 'Tirupati',
    deliveryPreference: 'APSRTC Bus Parcel',
    creditLimit: 30000,
    outstanding: 0,
  },
  {
    id: 'CUS-SAI-RAM-GENERAL-STORES',
    name: 'Sai Ram General Stores',
    type: 'Retail',
    phone: '9876502126',
    city: 'Kurnool',
    deliveryPreference: 'VRL Logistics',
    creditLimit: 40000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-VENKATESWARA-GROCERY',
    name: 'Sri Venkateswara Grocery',
    type: 'Retail',
    phone: '9876502127',
    city: 'Kakinada',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 45000,
    outstanding: 0,
  },
  {
    id: 'CUS-RAJESHWARI-PROVISIONS',
    name: 'Rajeshwari Provisions',
    type: 'Retail',
    phone: '9876502128',
    city: 'Rajahmundry',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 50000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-SAI-BALAJI-KIRANA',
    name: 'Sri Sai Balaji Kirana',
    type: 'Retail',
    phone: '9876502129',
    city: 'Kadapa',
    deliveryPreference: 'SBT Transport',
    creditLimit: 40000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-LAKSHMI-TIFFIN-CENTER',
    name: 'Sri Lakshmi Tiffin Center',
    type: 'Hotel',
    phone: '9876502130',
    city: 'Anantapur',
    deliveryPreference: 'Auto Transport',
    creditLimit: 30000,
    outstanding: 0,
  },
  {
    id: 'CUS-GANAPATHI-GENERAL-STORES',
    name: 'Ganapathi General Stores',
    type: 'Retail',
    phone: '9876502131',
    city: 'Ongole',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 40000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-DURGA-WHOLESALE-TRADERS',
    name: 'Sri Durga Wholesale Traders',
    type: 'Wholesale',
    phone: '9876502132',
    city: 'Vizianagaram',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 80000,
    outstanding: 0,
  },
  {
    id: 'CUS-VENKATA-RAMANA-KIRANA',
    name: 'Venkata Ramana Kirana',
    type: 'Retail',
    phone: '9876502133',
    city: 'Eluru',
    deliveryPreference: 'SBT Transport',
    creditLimit: 45000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-SATYA-SAI-PROVISIONS',
    name: 'Sri Satya Sai Provisions',
    type: 'Retail',
    phone: '9876502134',
    city: 'Proddatur',
    deliveryPreference: 'APSRTC Bus Parcel',
    creditLimit: 40000,
    outstanding: 0,
  },
  {
    id: 'CUS-SIVA-GANESH-TEA-STALL',
    name: 'Siva Ganesh Tea Stall',
    type: 'Hotel',
    phone: '9876502135',
    city: 'Nandyal',
    deliveryPreference: 'Auto Transport',
    creditLimit: 25000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-MALLIKARJUNA-STORES',
    name: 'Sri Mallikarjuna Stores',
    type: 'Retail',
    phone: '9876502136',
    city: 'Adoni',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-LAKSHMI-NARASIMHA-MART',
    name: 'Sri Lakshmi Narasimha Mart',
    type: 'Retail',
    phone: '9876502137',
    city: 'Madanapalle',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 40000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-RAMA-GENERAL-STORES',
    name: 'Sri Rama General Stores',
    type: 'Retail',
    phone: '9876502138',
    city: 'Machilipatnam',
    deliveryPreference: 'SBT Transport',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-VIJAYA-DURGA-KIRANA-STORES',
    name: 'Vijaya Durga Kirana Stores',
    type: 'Retail',
    phone: '9876502139',
    city: 'Tenali',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 45000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-VENKATA-LAKSHMI-TRADERS',
    name: 'Sri Venkata Lakshmi Traders',
    type: 'Wholesale',
    phone: '9876502140',
    city: 'Chittoor',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 75000,
    outstanding: 0,
  },
  {
    id: 'CUS-BALAJI-TEA-COOL-DRINKS',
    name: 'Balaji Tea & Cool Drinks',
    type: 'Hotel',
    phone: '9876502141',
    city: 'Hindupur',
    deliveryPreference: 'APSRTC Bus Parcel',
    creditLimit: 25000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-SAI-GANESH-PROVISIONS',
    name: 'Sri Sai Ganesh Provisions',
    type: 'Retail',
    phone: '9876502142',
    city: 'Srikakulam',
    deliveryPreference: 'SBT Transport',
    creditLimit: 40000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-BHAVANI-GENERAL-STORES',
    name: 'Sri Bhavani General Stores',
    type: 'Retail',
    phone: '9876502143',
    city: 'Bhimavaram',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 45000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-DURGA-KIRANA-RICE-DEPOT',
    name: 'Sri Durga Kirana & Rice Depot',
    type: 'Retail',
    phone: '9876502144',
    city: 'Tadepalligudem',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 50000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-LAKSHMI-GANAPATHI-STORES',
    name: 'Sri Lakshmi Ganapathi Stores',
    type: 'Retail',
    phone: '9876502145',
    city: 'Rajam',
    deliveryPreference: 'Auto Transport',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-RAMA-TEA-POINT',
    name: 'Sri Rama Tea Point',
    type: 'Hotel',
    phone: '9876502146',
    city: 'Bobbili',
    deliveryPreference: 'APSRTC Bus Parcel',
    creditLimit: 22000,
    outstanding: 0,
  },
  {
    id: 'CUS-VENKATESWARA-MINI-MART',
    name: 'Venkateswara Mini Mart',
    type: 'Retail',
    phone: '9876502147',
    city: 'Parvathipuram',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-KANAKA-MAHALAXMI-STORES',
    name: 'Sri Kanaka Mahalaxmi Stores',
    type: 'Retail',
    phone: '9876502148',
    city: 'Salur',
    deliveryPreference: 'SBT Transport',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-SAI-KRISHNA-GENERAL-STORES',
    name: 'Sai Krishna General Stores',
    type: 'Retail',
    phone: '9876502149',
    city: 'Palasa',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-DURGA-PROVISIONS',
    name: 'Sri Durga Provisions',
    type: 'Retail',
    phone: '9876502150',
    city: 'Tekkali',
    deliveryPreference: 'APSRTC Bus Parcel',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-VENKATA-SAI-TRADERS',
    name: 'Sri Venkata Sai Traders',
    type: 'Wholesale',
    phone: '9876502151',
    city: 'Amalapuram',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 75000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-LAKSHMI-RICE-KIRANA',
    name: 'Sri Lakshmi Rice & Kirana',
    type: 'Retail',
    phone: '9876502152',
    city: 'Mandapeta',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 40000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-SATYA-GENERAL-STORES',
    name: 'Sri Satya General Stores',
    type: 'Retail',
    phone: '9876502153',
    city: 'Ravulapalem',
    deliveryPreference: 'SBT Transport',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-RAMA-KRISHNA-TEA-STALL',
    name: 'Sri Rama Krishna Tea Stall',
    type: 'Hotel',
    phone: '9876502154',
    city: 'Tuni',
    deliveryPreference: 'Auto Transport',
    creditLimit: 25000,
    outstanding: 0,
  },
  {
    id: 'CUS-BHAVANI-KIRANA-STORES',
    name: 'Bhavani Kirana Stores',
    type: 'Retail',
    phone: '9876502155',
    city: 'Anakapalli',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 45000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-VENKATESWARA-PROVISIONS',
    name: 'Sri Venkateswara Provisions',
    type: 'Retail',
    phone: '9876502156',
    city: 'Narsipatnam',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 40000,
    outstanding: 0,
  },
  {
    id: 'CUS-SAI-DURGA-HOTEL-TIFFINS',
    name: 'Sai Durga Hotel & Tiffins',
    type: 'Hotel',
    phone: '9876502157',
    city: 'Pithapuram',
    deliveryPreference: 'APSRTC Bus Parcel',
    creditLimit: 30000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-MANIKANTA-KIRANA',
    name: 'Sri Manikanta Kirana',
    type: 'Retail',
    phone: '9876502158',
    city: 'Samalkot',
    deliveryPreference: 'SBT Transport',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-LAKSHMI-BALAJI-STORES',
    name: 'Sri Lakshmi Balaji Stores',
    type: 'Retail',
    phone: '9876502159',
    city: 'Gudivada',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 40000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-KANAKA-DURGA-TEA-STALL',
    name: 'Sri Kanaka Durga Tea Stall',
    type: 'Hotel',
    phone: '9876502160',
    city: 'Nuzvid',
    deliveryPreference: 'Auto Transport',
    creditLimit: 25000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-SAI-WHOLESALE-MART',
    name: 'Sri Sai Wholesale Mart',
    type: 'Wholesale',
    phone: '9876502161',
    city: 'Repalle',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 70000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-VENKATA-RAMANA-STORES',
    name: 'Sri Venkata Ramana Stores',
    type: 'Retail',
    phone: '9876502162',
    city: 'Chirala',
    deliveryPreference: 'SBT Transport',
    creditLimit: 45000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-LAKSHMI-PROVISIONS',
    name: 'Sri Lakshmi Provisions',
    type: 'Retail',
    phone: '9876502163',
    city: 'Markapur',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 40000,
    outstanding: 0,
  },
  {
    id: 'CUS-GANESH-KIRANA-GENERAL-STORES',
    name: 'Ganesh Kirana & General Stores',
    type: 'Retail',
    phone: '9876502164',
    city: 'Kandukur',
    deliveryPreference: 'APSRTC Bus Parcel',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-BHAVANI-TEA-POINT',
    name: 'Sri Bhavani Tea Point',
    type: 'Hotel',
    phone: '9876502165',
    city: 'Rayachoti',
    deliveryPreference: 'Auto Transport',
    creditLimit: 25000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-SAI-RAM-TRADERS',
    name: 'Sri Sai Ram Traders',
    type: 'Wholesale',
    phone: '9876502166',
    city: 'Jammalamadugu',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 70000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-VENKATESWARA-GENERAL-STORES',
    name: 'Sri Venkateswara General Stores',
    type: 'Retail',
    phone: '9876502167',
    city: 'Tadipatri',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 40000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-LAKSHMI-NARAYANA-HOTEL',
    name: 'Sri Lakshmi Narayana Hotel',
    type: 'Hotel',
    phone: '9876502168',
    city: 'Guntakal',
    deliveryPreference: 'SBT Transport',
    creditLimit: 30000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-ANJANEYA-KIRANA',
    name: 'Sri Anjaneya Kirana',
    type: 'Retail',
    phone: '9876502169',
    city: 'Dharmavaram',
    deliveryPreference: 'APSRTC Bus Parcel',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-SAI-BALAJI-PROVISIONS',
    name: 'Sai Balaji Provisions',
    type: 'Retail',
    phone: '9876502170',
    city: 'Puttaparthi',
    deliveryPreference: 'Auto Transport',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-PADMAVATHI-GENERAL-STORES',
    name: 'Sri Padmavathi General Stores',
    type: 'Retail',
    phone: '9876502171',
    city: 'Kavali',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 40000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-RAMA-TRADERS',
    name: 'Sri Rama Traders',
    type: 'Wholesale',
    phone: '9876502172',
    city: 'Gudur',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 70000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-VENKATA-SAI-TEA-STALL',
    name: 'Sri Venkata Sai Tea Stall',
    type: 'Hotel',
    phone: '9876502173',
    city: 'Sullurupeta',
    deliveryPreference: 'APSRTC Bus Parcel',
    creditLimit: 25000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-LAKSHMI-GANESH-STORES',
    name: 'Sri Lakshmi Ganesh Stores',
    type: 'Retail',
    phone: '9876502174',
    city: 'Venkatagiri',
    deliveryPreference: 'SBT Transport',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-SAI-DURGA-PROVISIONS',
    name: 'Sri Sai Durga Provisions',
    type: 'Retail',
    phone: '9876502175',
    city: 'Puttur',
    deliveryPreference: 'Auto Transport',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-BALAJI-GENERAL-MERCHANTS',
    name: 'Balaji General Merchants',
    type: 'Retail',
    phone: '9876502176',
    city: 'Nagari',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 35000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-VENKATESWARA-KIRANA',
    name: 'Sri Venkateswara Kirana',
    type: 'Retail',
    phone: '9876502177',
    city: 'Palamaner',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 40000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-SAI-TIFFIN-CENTER',
    name: 'Sri Sai Tiffin Center',
    type: 'Hotel',
    phone: '9876502178',
    city: 'Hyderabad',
    deliveryPreference: 'Auto Transport',
    creditLimit: 30000,
    outstanding: 0,
  },
  {
    id: 'CUS-HYDERABADJI-PROVISIONS-STORES',
    name: 'Hyderabadji Provisions Stores',
    type: 'Retail',
    phone: '9876502179',
    city: 'Hyderabad',
    deliveryPreference: 'Navata Road Transport',
    creditLimit: 50000,
    outstanding: 0,
  },
  {
    id: 'CUS-SRI-LAKSHMI-WHOLESALE-AGENCIES',
    name: 'Sri Lakshmi Wholesale Agencies',
    type: 'Wholesale',
    phone: '9876502180',
    city: 'Hyderabad',
    deliveryPreference: 'Kranti Road Transport',
    creditLimit: 95000,
    outstanding: 0,
  },
].map((customer) => ({
  ...customer,
  state: getCustomerStateForCity(customer.city),
}));

const seedData = {
  suppliers: [
    {
      id: 'SUP-MOKALBARI',
      name: 'Mokalbari Estate',
      agentName: 'Ramesh Agent',
      phone: '9000010421',
      region: 'Assam',
      paymentTerms: '15 days',
      outstanding: 45260,
      gstin: '',
      address: '',
    },
    {
      id: 'SUP-EASTERN',
      name: 'Eastern Estates',
      agentName: 'Prakash Tea Brokers',
      phone: '9000010446',
      region: 'Dooars',
      paymentTerms: '7 days',
      outstanding: 15840,
      gstin: '',
      address: '',
    },
    {
      id: 'SUP-BLUEMOUNTAIN',
      name: 'Blue Mountain Traders',
      agentName: 'Suresh Kumar',
      phone: '9000010390',
      region: 'Nilgiri',
      paymentTerms: '20 days',
      outstanding: 0,
      gstin: '',
      address: '',
    },
  ],
  supplierPayments: [
    {
      id: 'PAY-SUP-MOKALBARI-20250422',
      supplierId: 'SUP-MOKALBARI',
      supplierName: 'Mokalbari Estate',
      amount: 16060,
      paymentDate: '2025-04-22',
      mode: 'Bank transfer',
      reference: 'OPENING-PAYMENT',
      note: 'Opening supplier ledger payment',
    },
  ],
  customers: [
    {
      id: 'CUS-LAKSHMI',
      name: 'Sri Lakshmi Hotel Supplies',
      type: 'Wholesale',
      phone: '9885500112',
      city: 'Rajahmundry',
      deliveryPreference: 'Auto transport',
      creditLimit: 75000,
      outstanding: 11760,
    },
    {
      id: 'CUS-SRINIVASA',
      name: 'Srinivasa Retail Stores',
      type: 'Retailer',
      phone: '9885500133',
      city: 'Kakinada',
      deliveryPreference: 'Parcel service',
      creditLimit: 50000,
      outstanding: 0,
    },
    ...customerMasterImport,
  ],
  rawLots: [
    {
      id: 'RAW-ASSAM-BOP-20250419-01',
      supplierId: 'SUP-MOKALBARI',
      supplierName: 'Mokalbari Estate',
      variety: 'Assam CTC',
      grade: 'BOP',
      bags: 12,
      bagWeightKg: 35,
      receivedKg: 420,
      remainingKg: 310,
      costPerKg: 146,
      reorderKg: 80,
      receivedDate: '2025-04-19',
      quality: {
        taste: 9,
        color: 8,
        aroma: 8,
      },
      movements: [
        {
          id: 'MOV-RAW-01',
          type: 'Received',
          kg: 420,
          note: 'Opening stock received',
          date: '2025-04-19',
        },
        {
          id: 'MOV-RAW-02',
          type: 'Blend Issue',
          kg: -110,
          note: 'Used in Hotel Strong Blend',
          date: '2025-04-20',
        },
      ],
    },
    {
      id: 'RAW-DUST-STD-20250419-02',
      supplierId: 'SUP-EASTERN',
      supplierName: 'Eastern Estates',
      variety: 'Tea Dust',
      grade: 'Standard',
      bags: 6,
      bagWeightKg: 30,
      receivedKg: 180,
      remainingKg: 130,
      costPerKg: 88,
      reorderKg: 60,
      receivedDate: '2025-04-19',
      quality: {
        taste: 7,
        color: 9,
        aroma: 7,
      },
      movements: [
        {
          id: 'MOV-RAW-03',
          type: 'Received',
          kg: 180,
          note: 'Opening stock received',
          date: '2025-04-19',
        },
        {
          id: 'MOV-RAW-04',
          type: 'Blend Issue',
          kg: -50,
          note: 'Used in Hotel Strong Blend',
          date: '2025-04-20',
        },
      ],
    },
    {
      id: 'RAW-NILGIRI-FOP-20250418-03',
      supplierId: 'SUP-BLUEMOUNTAIN',
      supplierName: 'Blue Mountain Traders',
      variety: 'Nilgiri Leaf',
      grade: 'FOP',
      bags: 8,
      bagWeightKg: 30,
      receivedKg: 240,
      remainingKg: 220,
      costPerKg: 172,
      reorderKg: 70,
      receivedDate: '2025-04-18',
      quality: {
        taste: 8,
        color: 7,
        aroma: 9,
      },
      movements: [
        {
          id: 'MOV-RAW-05',
          type: 'Received',
          kg: 240,
          note: 'Opening stock',
          date: '2025-04-18',
        },
        {
          id: 'MOV-RAW-06',
          type: 'Blend Issue',
          kg: -20,
          note: 'Used in Hotel Strong Blend',
          date: '2025-04-20',
        },
      ],
    },
  ],
  blendBatches: [
    {
      id: 'BLD-HOTEL-STRONG-20250420-01',
      productName: 'Hotel Strong Blend',
      sku: 'HOTEL-STRONG',
      createdDate: '2025-04-20',
      batchKg: 180,
      remainingKg: 132,
      sellingPricePerKg: 245,
      packingCostPerKg: 12,
      laborCost: 900,
      overheadCost: 450,
      rawMaterialCost: 23900,
      packingCost: 2160,
      totalCost: 27410,
      costPerKg: 152.28,
      expectedRevenue: 44100,
      expectedProfit: 16690,
      packagingStatus: 'Packed',
      components: [
        {
          lotId: 'RAW-ASSAM-BOP-20250419-01',
          variety: 'Assam CTC',
          grade: 'BOP',
          kgUsed: 110,
          costPerKg: 146,
          cost: 16060,
        },
        {
          lotId: 'RAW-DUST-STD-20250419-02',
          variety: 'Tea Dust',
          grade: 'Standard',
          kgUsed: 50,
          costPerKg: 88,
          cost: 4400,
        },
        {
          lotId: 'RAW-NILGIRI-FOP-20250418-03',
          variety: 'Nilgiri Leaf',
          grade: 'FOP',
          kgUsed: 20,
          costPerKg: 172,
          cost: 3440,
        },
      ],
    },
  ],
  salesOrders: [
    {
      id: 'SO-20250421-01',
      customerId: 'CUS-LAKSHMI',
      customerName: 'Sri Lakshmi Hotel Supplies',
      itemType: 'blend',
      itemId: 'BLD-HOTEL-STRONG-20250420-01',
      itemName: 'Hotel Strong Blend',
      kg: 48,
      pricePerKg: 245,
      shippingCharge: 0,
      revenue: 11760,
      cogs: 7309.44,
      profit: 4450.56,
      orderDate: '2025-04-21',
      status: 'Delivered',
      saleType: 'Wholesale',
      paymentMode: 'Credit',
      paidAmount: 0,
      balanceDue: 11760,
      paymentStatus: 'Due',
    },
  ],
  shipments: [
    {
      id: 'SHIP-20250421-01',
      orderId: 'SO-20250421-01',
      customerName: 'Sri Lakshmi Hotel Supplies',
      destination: 'Rajahmundry',
      transportMode: 'Auto transport',
      vehicleNo: 'AP05-T-4411',
      status: 'Delivered',
      packedDate: '2025-04-21',
      shippedDate: '2025-04-21',
      deliveredDate: '2025-04-21',
      note: 'Delivered to hotel stores counter',
    },
  ],
  invoiceReceipts: [],
  invoiceDrafts: [],
};

const EnterpriseContext = createContext(null);

function slugify(value, fallback = 'ITEM') {
  const slug = String(value || fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 18);

  return slug || fallback;
}

function makeId(prefix, value) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${slugify(value)}-${datePart}-${randomPart}`;
}

function normalizeBagSize(value) {
  return roundMoney(numberValue(value));
}

function bagSizeMatches(left, right) {
  return Math.abs(normalizeBagSize(left) - normalizeBagSize(right)) < 0.001;
}

function bagSizeSlug(value) {
  return String(normalizeBagSize(value)).replace(/[^0-9]+/g, 'P');
}

function makeBagSizeOptionId(lotId, bagSizeKg) {
  return `${lotId}-SIZE-${bagSizeSlug(bagSizeKg)}`;
}

function makeBagUnitId(lotId, bagSizeKg, index) {
  return `${lotId}-BAG-${bagSizeSlug(bagSizeKg)}-${String(index + 1).padStart(3, '0')}`;
}

function parseBagBreakdown(value) {
  const specs = [];
  const pattern = /(\d+(?:\.\d+)?)\s*(?:x|\*)\s*(\d+(?:\.\d+)?)/gi;

  for (const match of String(value || '').matchAll(pattern)) {
    const receivedBagCount = numberValue(match[1]);
    const bagSizeKg = normalizeBagSize(match[2]);

    if (receivedBagCount > 0 && bagSizeKg > 0) {
      specs.push({ receivedBagCount, bagSizeKg });
    }
  }

  return specs;
}

function combineBagSpecs(specs) {
  const groupedSpecs = new Map();

  specs.forEach((spec) => {
    const bagSizeKg = normalizeBagSize(spec.bagSizeKg);
    const receivedBagCount = numberValue(spec.receivedBagCount ?? spec.bagCount);

    if (bagSizeKg <= 0 || receivedBagCount <= 0) {
      return;
    }

    const key = String(bagSizeKg);
    const currentSpec = groupedSpecs.get(key) || {
      bagSizeKg,
      receivedBagCount: 0,
    };

    groupedSpecs.set(key, {
      ...currentSpec,
      receivedBagCount: roundMoney(currentSpec.receivedBagCount + receivedBagCount),
    });
  });

  return [...groupedSpecs.values()].sort((left, right) => left.bagSizeKg - right.bagSizeKg);
}

function formatBagBreakdown(specs) {
  return combineBagSpecs(specs)
    .map((spec) => `${spec.receivedBagCount} x ${spec.bagSizeKg}`)
    .join(', ');
}

function getDraftBagSpecs(item, numbers) {
  const parsedSpecs = combineBagSpecs(parseBagBreakdown(item.bagBreakdown));

  if (parsedSpecs.length) {
    return parsedSpecs;
  }

  const receivedBagCount = numbers.quantity;
  const inferredBagSize =
    receivedBagCount > 0
      ? presentNumber(item.unitWeightKg, numbers.receivedKg / receivedBagCount)
      : presentNumber(item.unitWeightKg);

  return combineBagSpecs([
    {
      receivedBagCount,
      bagSizeKg: inferredBagSize,
    },
  ]);
}

function getLotBagSpecs(lot) {
  if (Array.isArray(lot.bagSizeOptions) && lot.bagSizeOptions.length) {
    return combineBagSpecs(
      lot.bagSizeOptions.map((option) => ({
        bagSizeKg: option.bagSizeKg,
        receivedBagCount: option.receivedBagCount,
      }))
    );
  }

  const parsedSpecs = combineBagSpecs(parseBagBreakdown(lot.bagBreakdown));

  if (parsedSpecs.length) {
    return parsedSpecs;
  }

  return combineBagSpecs([
    {
      receivedBagCount: presentNumber(lot.bags, 0),
      bagSizeKg: presentNumber(
        lot.bagWeightKg,
        presentNumber(lot.receivedKg) > 0 && presentNumber(lot.bags) > 0
          ? presentNumber(lot.receivedKg) / presentNumber(lot.bags)
          : 0
      ),
    },
  ]);
}

function createBagSizeOptions(lotId, specs) {
  return combineBagSpecs(specs).map((spec) => ({
    id: makeBagSizeOptionId(lotId, spec.bagSizeKg),
    bagSizeKg: spec.bagSizeKg,
    receivedBagCount: spec.receivedBagCount,
    remainingBagCount: spec.receivedBagCount,
    consumedBagCount: 0,
  }));
}

function normalizeBagSizeOptions(lot) {
  if (Array.isArray(lot.bagSizeOptions) && lot.bagSizeOptions.length) {
    return lot.bagSizeOptions
      .map((option) => {
        const bagSizeKg = normalizeBagSize(option.bagSizeKg);
        const receivedBagCount = presentNumber(option.receivedBagCount);
        const remainingBagCount = Math.max(
          Math.min(presentNumber(option.remainingBagCount, receivedBagCount), receivedBagCount),
          0
        );

        if (bagSizeKg <= 0 || receivedBagCount <= 0) {
          return null;
        }

        return {
          id: option.id || makeBagSizeOptionId(lot.id, bagSizeKg),
          bagSizeKg,
          receivedBagCount: roundMoney(receivedBagCount),
          remainingBagCount: roundMoney(remainingBagCount),
          consumedBagCount: roundMoney(receivedBagCount - remainingBagCount),
        };
      })
      .filter(Boolean);
  }

  let remainingKgToAllocate = presentNumber(lot.remainingKg, lot.receivedKg);

  return getLotBagSpecs(lot).map((spec) => {
    const receivedBagCount = spec.receivedBagCount;
    const wholeRemainingBags = Math.min(
      receivedBagCount,
      Math.floor((remainingKgToAllocate + 0.0001) / spec.bagSizeKg)
    );
    remainingKgToAllocate = Math.max(
      roundMoney(remainingKgToAllocate - wholeRemainingBags * spec.bagSizeKg),
      0
    );

    return {
      id: makeBagSizeOptionId(lot.id, spec.bagSizeKg),
      bagSizeKg: spec.bagSizeKg,
      receivedBagCount,
      remainingBagCount: wholeRemainingBags,
      consumedBagCount: roundMoney(receivedBagCount - wholeRemainingBags),
    };
  });
}

function normalizeBagUnits(lot, bagSizeOptions) {
  const existingUnits = Array.isArray(lot.bagUnits)
    ? lot.bagUnits
        .map((unit) => {
          const option = bagSizeOptions.find((item) =>
            bagSizeMatches(item.bagSizeKg, unit.bagSizeKg)
          );

          if (!option) {
            return null;
          }

          return {
            id: unit.id || makeBagUnitId(lot.id, option.bagSizeKg, 0),
            lotId: lot.id,
            bagSizeKg: option.bagSizeKg,
            status: unit.status === 'consumed' ? 'consumed' : 'available',
            consumedByBlendId: unit.consumedByBlendId || '',
            consumedDate: unit.consumedDate || '',
          };
        })
        .filter(Boolean)
    : [];
  const nextUnits = [...existingUnits];

  bagSizeOptions.forEach((option) => {
    const existingForSize = nextUnits.filter((unit) =>
      bagSizeMatches(unit.bagSizeKg, option.bagSizeKg)
    );
    const availableForSize = existingForSize.filter((unit) => unit.status === 'available').length;
    const neededAvailableUnits = Math.floor(option.remainingBagCount);

    for (
      let index = existingForSize.length;
      availableForSize + (index - existingForSize.length) < neededAvailableUnits;
      index += 1
    ) {
      nextUnits.push({
        id: makeBagUnitId(lot.id, option.bagSizeKg, index),
        lotId: lot.id,
        bagSizeKg: option.bagSizeKg,
        status: 'available',
        consumedByBlendId: '',
        consumedDate: '',
      });
    }
  });

  return nextUnits;
}

function normalizeRawLot(lot) {
  const rawLot = { ...lot };
  delete rawLot[LEGACY_STOCK_INTAKE_KEYS.lineDocumentId];
  const bagSizeOptions = normalizeBagSizeOptions(rawLot);

  return {
    ...rawLot,
    bagBreakdown: rawLot.bagBreakdown || formatBagBreakdown(bagSizeOptions),
    bagSizeOptions,
    bagUnits: normalizeBagUnits(rawLot, bagSizeOptions),
  };
}

function getRawLotBagOptions(lot) {
  return (lot?.bagSizeOptions || []).filter((option) => option.remainingBagCount > 0);
}

function getAvailableBagCount(lot, bagSizeKg) {
  const option = getRawLotBagOptions(lot).find((item) => bagSizeMatches(item.bagSizeKg, bagSizeKg));

  return option ? Math.floor(option.remainingBagCount) : 0;
}

function getReservableBagUnitIds(lot, bagSizeKg, count, preferredBagIds = [], reservedBagIds) {
  const requestedCount = Math.max(Math.floor(numberValue(count)), 0);
  const result = [];
  const reserved = reservedBagIds || new Set();

  preferredBagIds.forEach((bagId) => {
    const unit = (lot.bagUnits || []).find((item) => item.id === bagId);

    if (
      unit &&
      unit.status === 'available' &&
      bagSizeMatches(unit.bagSizeKg, bagSizeKg) &&
      !reserved.has(unit.id) &&
      result.length < requestedCount
    ) {
      result.push(unit.id);
      reserved.add(unit.id);
    }
  });

  (lot.bagUnits || []).forEach((unit) => {
    if (
      result.length < requestedCount &&
      unit.status === 'available' &&
      bagSizeMatches(unit.bagSizeKg, bagSizeKg) &&
      !reserved.has(unit.id)
    ) {
      result.push(unit.id);
      reserved.add(unit.id);
    }
  });

  return result;
}

function consumeBlendComponentFromLot(lot, component, blendBatch) {
  const requestedBagCount = Math.max(Math.floor(numberValue(component.bagCount)), 0);
  const consumedBagIds = new Set(component.bagIds || []);
  let unitsToConsume = Math.max(requestedBagCount - consumedBagIds.size, 0);
  const bagSizeOptions = (lot.bagSizeOptions || []).map((option) => {
    if (!bagSizeMatches(option.bagSizeKg, component.bagSizeKg)) {
      return option;
    }

    const remainingBagCount = Math.max(
      roundMoney(numberValue(option.remainingBagCount) - requestedBagCount),
      0
    );

    return {
      ...option,
      remainingBagCount,
      consumedBagCount: roundMoney(numberValue(option.receivedBagCount) - remainingBagCount),
    };
  });
  const bagUnits = (lot.bagUnits || []).map((unit) => {
    const shouldConsumeById = consumedBagIds.has(unit.id);
    const shouldConsumeByCount =
      !shouldConsumeById &&
      unitsToConsume > 0 &&
      unit.status === 'available' &&
      bagSizeMatches(unit.bagSizeKg, component.bagSizeKg);

    if (!shouldConsumeById && !shouldConsumeByCount) {
      return unit;
    }

    if (shouldConsumeByCount) {
      unitsToConsume -= 1;
    }

    return {
      ...unit,
      status: 'consumed',
      consumedByBlendId: blendBatch.id,
      consumedDate: blendBatch.createdDate,
    };
  });

  return normalizeRawLot({
    ...lot,
    remainingKg: Math.max(roundMoney(numberValue(lot.remainingKg) - component.kgUsed), 0),
    bagSizeOptions,
    bagUnits,
    movements: [
      {
        id: makeId('MOV', lot.variety),
        type: 'Blend Issue',
        kg: -component.kgUsed,
        note: `${requestedBagCount} bag(s) x ${component.bagSizeKg} kg used in ${blendBatch.productName}`,
        date: blendBatch.createdDate,
      },
      ...(lot.movements || []),
    ],
  });
}

function normalizeInvoiceReceipt(invoice) {
  const invoiceRecord = { ...invoice };
  delete invoiceRecord[LEGACY_STOCK_INTAKE_KEYS.invoiceDocumentIds];

  return {
    ...invoiceRecord,
    status: invoice.status || 'Approved',
    rawLotIds: invoice.rawLotIds || [],
    lineItems: (invoice.lineItems || []).map((line) => {
      const lineRecord = { ...line };
      delete lineRecord[LEGACY_STOCK_INTAKE_KEYS.lineDocumentId];
      return lineRecord;
    }),
    charges: invoice.charges || [],
  };
}

function normalizeInvoiceDraft(draft) {
  return {
    ...draft,
    id: draft.id || makeId('DRAFT', draft.invoice?.number || draft.vendor?.name || 'invoice'),
    status: draft.status || 'Draft',
    createdAt: draft.createdAt || draft.extractedAt || today,
    updatedAt: draft.updatedAt || today,
    charges: draft.charges || [],
    items: draft.items?.length ? draft.items : [invoiceRecordLineToDraftLine({})],
  };
}

function normalizeSupplierRecord(supplier) {
  return {
    ...supplier,
    phone: normalizeIndianMobile(supplier.phone) || supplier.phone || '',
    paymentTerms: validatePaymentTermDays(supplier.paymentTerms)
      ? supplier.paymentTerms || ''
      : formatPaymentTerms(supplier.paymentTerms),
    gstin: sanitizeGstinInput(supplier.gstin),
  };
}

function normalizeCustomerRecord(customer) {
  const city = customer.city?.trim() || '';

  return {
    ...customer,
    phone: normalizeIndianMobile(customer.phone) || customer.phone || '',
    city,
    state: customer.state?.trim() || getCustomerStateForCity(city),
    address: customer.address || '',
  };
}

function mergeCustomerMasterImport(customers) {
  const importById = new Map(customerMasterImport.map((customer) => [customer.id, customer]));
  const importByName = new Map(
    customerMasterImport.map((customer) => [normalizeKey(customer.name), customer])
  );
  const importByPhone = new Map(
    customerMasterImport
      .map((customer) => [normalizeIndianMobile(customer.phone), customer])
      .filter(([phone]) => phone)
  );
  const mergedCustomers = customers.map((customer) => {
    const importedCustomer =
      importById.get(customer.id) ||
      importByName.get(normalizeKey(customer.name)) ||
      importByPhone.get(normalizeIndianMobile(customer.phone));

    if (!importedCustomer) {
      return normalizeCustomerRecord(customer);
    }

    const imported = normalizeCustomerRecord(importedCustomer);
    const current = normalizeCustomerRecord(customer);

    return {
      ...imported,
      ...current,
      type: current.type || imported.type,
      phone: current.phone || imported.phone,
      city: current.city || imported.city,
      state: current.state || imported.state,
      address: current.address || imported.address,
      deliveryPreference: current.deliveryPreference || imported.deliveryPreference,
      creditLimit: current.creditLimit ?? imported.creditLimit,
      outstanding: current.outstanding ?? imported.outstanding,
    };
  });
  const existingIds = new Set(mergedCustomers.map((customer) => customer.id).filter(Boolean));
  const existingNames = new Set(mergedCustomers.map((customer) => normalizeKey(customer.name)));
  const existingPhones = new Set(
    mergedCustomers.map((customer) => normalizeIndianMobile(customer.phone)).filter(Boolean)
  );

  const importedCustomers = [];

  customerMasterImport.forEach((customer) => {
    const nameKey = normalizeKey(customer.name);
    const phone = normalizeIndianMobile(customer.phone);

    if (
      existingIds.has(customer.id) ||
      existingNames.has(nameKey) ||
      (phone && existingPhones.has(phone))
    ) {
      return;
    }

    const normalizedCustomer = normalizeCustomerRecord(customer);
    importedCustomers.push(normalizedCustomer);
    existingIds.add(normalizedCustomer.id);
    existingNames.add(nameKey);

    if (phone) {
      existingPhones.add(phone);
    }
  });

  return [...mergedCustomers, ...importedCustomers];
}

function normalizeSalesOrderRecord(order) {
  const revenue = numberValue(order.revenue);
  const paidAmount =
    order.paidAmount === undefined
      ? order.paymentMode && order.paymentMode !== 'Credit'
        ? revenue
        : 0
      : numberValue(order.paidAmount);
  const balanceDue =
    order.balanceDue === undefined
      ? Math.max(roundMoney(revenue - paidAmount), 0)
      : Math.max(roundMoney(numberValue(order.balanceDue)), 0);

  return {
    ...order,
    paymentMode: order.paymentMode || (paidAmount > 0 ? 'Paid' : 'Credit'),
    paidAmount: roundMoney(paidAmount),
    balanceDue,
    paymentStatus: order.paymentStatus || (balanceDue > 0 ? 'Due' : 'Paid'),
  };
}

function normalizeData(data) {
  const customers = (data.customers || []).map(normalizeCustomerRecord);

  return {
    suppliers: (data.suppliers || []).map(normalizeSupplierRecord),
    supplierPayments: data.supplierPayments || [],
    customers: mergeCustomerMasterImport(customers),
    rawLots: (data.rawLots || []).map(normalizeRawLot),
    blendBatches: data.blendBatches || [],
    salesOrders: (data.salesOrders || []).map(normalizeSalesOrderRecord),
    shipments: data.shipments || [],
    invoiceReceipts: (data.invoiceReceipts || []).map(normalizeInvoiceReceipt),
    invoiceDrafts: (data.invoiceDrafts || []).map(normalizeInvoiceDraft),
  };
}

function loadData() {
  try {
    const storedData = window.localStorage.getItem(STORAGE_KEY);
    return storedData ? normalizeData(JSON.parse(storedData)) : normalizeData(seedData);
  } catch {
    return normalizeData(seedData);
  }
}

function createBlendPreview(form, rawLots) {
  const components = (form.components || [])
    .map((component) => {
      const lot = rawLots.find((rawLot) => rawLot.id === component.lotId);
      const bagSizeKg = normalizeBagSize(component.bagSizeKg);
      const bagCount = presentNumber(component.bagCount);
      const kgFromBags = bagSizeKg > 0 && bagCount > 0 ? roundMoney(bagSizeKg * bagCount) : 0;
      const kgUsed = presentNumber(component.kg ?? component.kgUsed, kgFromBags);

      if (!lot || kgUsed <= 0) {
        return null;
      }

      return {
        lot,
        bagSizeKg,
        bagCount: bagCount > 0 ? bagCount : bagSizeKg > 0 ? roundMoney(kgUsed / bagSizeKg) : 0,
        bagIds: component.bagIds || [],
        kgUsed,
        cost: roundMoney(kgUsed * lot.costPerKg),
      };
    })
    .filter(Boolean);
  const batchKg = components.reduce((total, component) => total + component.kgUsed, 0);
  const rawMaterialCost = components.reduce((total, component) => total + component.cost, 0);
  const packingCost = batchKg * numberValue(form.packingCostPerKg);
  const laborCost = numberValue(form.laborCost);
  const overheadCost = numberValue(form.overheadCost);
  const totalCost = rawMaterialCost + packingCost + laborCost + overheadCost;
  const sellingPricePerKg = numberValue(form.sellingPricePerKg);
  const expectedRevenue = batchKg * sellingPricePerKg;
  const expectedProfit = expectedRevenue - totalCost;

  return {
    components,
    batchKg: roundMoney(batchKg),
    rawMaterialCost: roundMoney(rawMaterialCost),
    packingCost: roundMoney(packingCost),
    laborCost: roundMoney(laborCost),
    overheadCost: roundMoney(overheadCost),
    totalCost: roundMoney(totalCost),
    costPerKg: batchKg > 0 ? roundMoney(totalCost / batchKg) : 0,
    sellingPricePerKg,
    expectedRevenue: roundMoney(expectedRevenue),
    expectedProfit: roundMoney(expectedProfit),
    marginPercent: expectedRevenue > 0 ? roundMoney((expectedProfit / expectedRevenue) * 100) : 0,
  };
}

function getInventoryItem(data, itemType, itemId) {
  if (itemType === 'raw') {
    return data.rawLots.find((lot) => lot.id === itemId);
  }

  return data.blendBatches.find((batch) => batch.id === itemId);
}

function getItemCostPerKg(itemType, item) {
  if (!item) {
    return 0;
  }

  return itemType === 'raw' ? item.costPerKg : item.costPerKg;
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getCustomerStateForCity(city) {
  return customerStateByCity.get(normalizeKey(city)) || '';
}

function regionFromAddress(address) {
  const addressParts = String(address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return addressParts.slice(-2, -1)[0] || addressParts.at(-1) || 'Invoice Vendor';
}

function getInvoiceLineNumbers(item) {
  const quantity = presentNumber(item.quantity);
  const unitWeightKg = presentNumber(item.unitWeightKg, 1);
  const receivedKg = presentNumber(item.receivedKg, quantity * unitWeightKg);
  const taxableValue = presentNumber(item.taxableValue);
  const ratePerKg = presentNumber(item.ratePerKg, receivedKg > 0 ? taxableValue / receivedKg : 0);
  const cgstAmount = presentNumber(item.cgstAmount);
  const sgstAmount = presentNumber(item.sgstAmount);
  const igstAmount = presentNumber(item.igstAmount);
  const lineTotal = presentNumber(
    item.lineTotal,
    taxableValue + cgstAmount + sgstAmount + igstAmount
  );

  return {
    quantity,
    unitWeightKg,
    receivedKg,
    taxableValue: roundMoney(taxableValue || receivedKg * ratePerKg),
    ratePerKg: roundMoney(ratePerKg),
    cgstRate: presentNumber(item.cgstRate),
    cgstAmount: roundMoney(cgstAmount),
    sgstRate: presentNumber(item.sgstRate),
    sgstAmount: roundMoney(sgstAmount),
    igstRate: presentNumber(item.igstRate),
    igstAmount: roundMoney(igstAmount),
    lineTotal: roundMoney(lineTotal),
    reorderKg: presentNumber(item.reorderKg, Math.max(receivedKg * 0.2, 25)),
  };
}

function getInvoiceCharges(draft) {
  return (draft.charges || [])
    .map((charge) => ({
      id: charge.id || makeId('CHG', charge.label || charge.category || 'charge'),
      label: charge.label?.trim() || charge.category?.trim() || 'Miscellaneous charge',
      category: charge.category?.trim() || 'Miscellaneous',
      amount: roundMoney(presentNumber(charge.amount)),
      allocationMethod: charge.allocationMethod || 'By kg',
      includeInLandedCost: charge.includeInLandedCost !== false,
    }))
    .filter((charge) => charge.amount > 0);
}

function inputValue(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  return String(value);
}

function invoiceRecordLineToDraftLine(line) {
  return {
    id: makeId('LINE', line.teaName || 'stock-line'),
    teaName: line.teaName || '',
    grade: line.grade || '',
    bagCount: inputValue(line.quantity),
    bagWeightKg: inputValue(line.unitWeightKg),
    bagBreakdown: line.bagBreakdown || '',
    parentLineId: '',
    hsn: line.hsn || '',
    quantity: inputValue(line.quantity),
    unit: line.unit || 'Bags',
    unitWeightKg: inputValue(line.unitWeightKg || 1),
    receivedKg: inputValue(line.receivedKg),
    ratePerKg: inputValue(line.ratePerKg),
    taxableValue: inputValue(line.taxableValue),
    gstRate: '',
    cgstRate: inputValue(line.cgstRate),
    cgstAmount: inputValue(line.cgstAmount),
    sgstRate: inputValue(line.sgstRate),
    sgstAmount: inputValue(line.sgstAmount),
    igstRate: inputValue(line.igstRate),
    igstAmount: inputValue(line.igstAmount),
    lineTotal: inputValue(line.lineTotal),
    reorderKg: inputValue(line.reorderKg || Math.max(numberValue(line.receivedKg) * 0.2, 25)),
    confidence: line.confidence || 0,
  };
}

function invoiceReceiptToCorrectionDraft(invoice, reason) {
  return normalizeInvoiceDraft({
    id: makeId('DRAFT', invoice.invoiceNumber || invoice.id),
    status: 'Correction Draft',
    correctionOfInvoiceId: invoice.id,
    correctionReason: reason,
    sourceName: invoice.sourceName || '',
    sourceType: invoice.sourceType || 'Correction',
    pageCount: invoice.pageCount || 0,
    extractionMode: invoice.extractionMode || 'Correction draft',
    extractedAt: today,
    confidence: invoice.confidence || 0,
    vendor: {
      name: invoice.supplierName || '',
      address: invoice.vendorAddress || '',
      gstin: invoice.vendorGstin || '',
      phone: '',
      state: '',
    },
    invoice: {
      number: invoice.invoiceNumber || '',
      date: invoice.invoiceDate || today,
      type: 'Tax Invoice',
    },
    totals: {
      taxableValue: inputValue(invoice.taxableValue),
      cgstAmount: inputValue(invoice.cgstAmount),
      sgstAmount: inputValue(invoice.sgstAmount),
      igstAmount: inputValue(invoice.igstAmount),
      totalTaxAmount: inputValue(invoice.totalTaxAmount),
      grossTotal: inputValue(invoice.grossTotal),
      netTotal: inputValue(invoice.netTotal),
      miscChargesTotal: inputValue(invoice.miscChargesTotal),
      roundOff: '',
    },
    charges: (invoice.charges || []).map((charge) => ({
      ...charge,
      id: makeId('CHG', charge.label || charge.category || 'charge'),
      amount: inputValue(charge.amount),
    })),
    items: (invoice.lineItems || []).map(invoiceRecordLineToDraftLine),
    rawText: invoice.rawText || '',
    extractionMetadata: {
      teaProductCount: (invoice.lineItems || []).length,
      lineItemsConfidence: [],
      gstType: '',
      duplicateRowsSkipped: 0,
    },
  });
}

function getInvoiceReversalBlockersForData(data, invoice) {
  const rawLotIds = new Set(invoice?.rawLotIds || []);

  if (!invoice) {
    return ['Invoice was not found.'];
  }

  if (invoice.status !== 'Approved') {
    return ['Only approved invoices can be reverted.'];
  }

  if (!rawLotIds.size) {
    return ['This invoice is not linked to generated stock lots.'];
  }

  const generatedLots = (invoice.rawLotIds || [])
    .map((lotId) => data.rawLots.find((lot) => lot.id === lotId))
    .filter(Boolean);
  const missingLots = (invoice.rawLotIds || []).filter(
    (lotId) => !generatedLots.some((lot) => lot.id === lotId)
  );
  const consumedLots = generatedLots.filter(
    (lot) => numberValue(lot.remainingKg) < numberValue(lot.receivedKg)
  );
  const usedInBlend = data.blendBatches.some((batch) =>
    (batch.components || []).some((component) => rawLotIds.has(component.lotId))
  );
  const soldDirectly = data.salesOrders.some(
    (order) => order.itemType === 'raw' && rawLotIds.has(order.itemId)
  );
  const blockers = [];

  if (missingLots.length) {
    blockers.push('Generated stock lots are no longer all active in inventory.');
  }

  if (consumedLots.length) {
    blockers.push('One or more generated lots already have issued or consumed stock.');
  }

  if (usedInBlend) {
    blockers.push('Generated stock is already used in a production blend.');
  }

  if (soldDirectly) {
    blockers.push('Generated stock is already linked to a sales order.');
  }

  return blockers;
}

export function EnterpriseProvider({ children }) {
  const [data, setData] = useState(loadData);
  const dataWithCustomerStates = useMemo(() => {
    const mergedCustomers = mergeCustomerMasterImport(
      (data.customers || []).map(normalizeCustomerRecord)
    );

    if (JSON.stringify(mergedCustomers) === JSON.stringify(data.customers || [])) {
      return data;
    }

    return {
      ...data,
      customers: mergedCustomers,
    };
  }, [data]);

  useEffect(() => {
    setData((currentData) => {
      const normalizedCustomers = (currentData.customers || []).map(normalizeCustomerRecord);
      const mergedCustomers = mergeCustomerMasterImport(normalizedCustomers);

      if (JSON.stringify(mergedCustomers) === JSON.stringify(currentData.customers || [])) {
        return currentData;
      }

      return {
        ...currentData,
        customers: mergedCustomers,
      };
    });
  }, [data.customers]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const metrics = useMemo(() => {
    const rawKg = data.rawLots.reduce((total, lot) => total + numberValue(lot.remainingKg), 0);
    const rawValue = data.rawLots.reduce(
      (total, lot) => total + numberValue(lot.remainingKg) * numberValue(lot.costPerKg),
      0
    );
    const finishedKg = data.blendBatches.reduce(
      (total, batch) => total + numberValue(batch.remainingKg),
      0
    );
    const finishedValue = data.blendBatches.reduce(
      (total, batch) => total + numberValue(batch.remainingKg) * numberValue(batch.costPerKg),
      0
    );
    const salesRevenue = data.salesOrders.reduce(
      (total, order) => total + numberValue(order.revenue),
      0
    );
    const salesProfit = data.salesOrders.reduce(
      (total, order) => total + numberValue(order.profit),
      0
    );
    const supplierOutstanding = data.suppliers.reduce(
      (total, supplier) => total + numberValue(supplier.outstanding),
      0
    );
    const customerOutstanding = data.customers.reduce(
      (total, customer) => total + numberValue(customer.outstanding),
      0
    );

    return {
      rawKg: roundMoney(rawKg),
      rawValue: roundMoney(rawValue),
      finishedKg: roundMoney(finishedKg),
      finishedValue: roundMoney(finishedValue),
      salesRevenue: roundMoney(salesRevenue),
      salesProfit: roundMoney(salesProfit),
      supplierOutstanding: roundMoney(supplierOutstanding),
      customerOutstanding: roundMoney(customerOutstanding),
      lowRawLots: data.rawLots.filter((lot) => lot.remainingKg <= lot.reorderKg).length,
      openShipments: data.shipments.filter((shipment) => shipment.status !== 'Delivered').length,
    };
  }, [data]);

  function addSupplier(form) {
    const supplierName = form.name.trim();
    const phoneError = validateOptionalIndianMobile(form.phone, 'Supplier phone');
    const gstin = sanitizeGstinInput(form.gstin);
    const gstinError = validateOptionalGstin(gstin, 'Supplier GSTIN');
    const termsError = validatePaymentTermDays(form.paymentTerms);

    if (!supplierName) {
      throw new Error('Supplier name is required.');
    }

    if (phoneError) {
      throw new Error(phoneError);
    }

    if (gstinError) {
      throw new Error(gstinError);
    }

    if (termsError) {
      throw new Error(termsError);
    }

    if (
      data.suppliers.some((supplier) => normalizeKey(supplier.name) === normalizeKey(supplierName))
    ) {
      throw new Error('This supplier is already in the ledger.');
    }

    const supplier = {
      id: makeId('SUP', supplierName),
      name: supplierName,
      agentName: form.agentName.trim(),
      phone: normalizeIndianMobile(form.phone),
      region: form.region.trim(),
      paymentTerms: formatPaymentTerms(form.paymentTerms),
      gstin,
      address: form.address?.trim() || '',
      outstanding: 0,
    };

    setData((currentData) => ({
      ...currentData,
      suppliers: [supplier, ...currentData.suppliers],
    }));

    return supplier;
  }

  function approveInvoiceReceipt(draft) {
    const vendorName = draft.vendor?.name?.trim();
    const vendorPhoneError = validateOptionalIndianMobile(draft.vendor?.phone, 'Vendor phone');
    const vendorGstin = sanitizeGstinInput(draft.vendor?.gstin);
    const vendorGstinError = validateOptionalGstin(vendorGstin, 'Vendor GSTIN');
    const invoiceNumber = draft.invoice?.number?.trim() || 'Unnumbered';
    const invoiceDate = draft.invoice?.date || today;
    const draftItems = (draft.items || []).filter((item) => item.teaName?.trim());

    if (!vendorName) {
      throw new Error('Vendor name is required before approving the invoice.');
    }

    if (vendorPhoneError) {
      throw new Error(vendorPhoneError);
    }

    if (vendorGstinError) {
      throw new Error(vendorGstinError);
    }

    if (invoiceDate > today) {
      throw new Error('Invoice date cannot be in the future.');
    }

    if (!draftItems.length) {
      throw new Error('Add at least one invoice stock line before approval.');
    }

    const invalidItem = draftItems.find((item) => {
      const numbers = getInvoiceLineNumbers(item);
      return (
        !item.teaName.trim() ||
        numbers.quantity <= 0 ||
        numbers.receivedKg <= 0 ||
        numbers.ratePerKg <= 0
      );
    });

    if (invalidItem) {
      throw new Error('Every stock line needs name, quantity, received kg, and rate/kg.');
    }

    const existingSupplier = data.suppliers.find(
      (supplier) => normalizeKey(supplier.name) === normalizeKey(vendorName)
    );
    const generatedSupplier = {
      id: makeId('SUP', vendorName),
      name: vendorName,
      agentName: 'Invoice Intake',
      phone: normalizeIndianMobile(draft.vendor?.phone),
      region: regionFromAddress(draft.vendor?.address),
      paymentTerms: 'Invoice due',
      outstanding: 0,
      gstin: vendorGstin,
      address: draft.vendor?.address?.trim() || '',
    };
    const invoiceId = makeId('INV', invoiceNumber);
    const correctionOfInvoiceId = draft.correctionOfInvoiceId || '';
    let approvalResult = null;

    setData((currentData) => {
      const currentSupplier =
        currentData.suppliers.find(
          (supplier) => normalizeKey(supplier.name) === normalizeKey(vendorName)
        ) ||
        existingSupplier ||
        generatedSupplier;
      const lineItems = draftItems.map((item) => {
        const numbers = getInvoiceLineNumbers(item);
        const grade = item.grade?.trim() || item.hsn?.trim() || 'Invoice';
        const bagSpecs = getDraftBagSpecs(item, numbers);
        const bagWeightKg =
          numbers.quantity > 0
            ? numbers.receivedKg / numbers.quantity
            : bagSpecs[0]?.bagSizeKg || 1;
        const rawLotId = makeId('RAW', `${item.teaName}-${grade}`);

        return {
          draft: item,
          numbers,
          grade,
          bagSpecs,
          bagBreakdown: formatBagBreakdown(bagSpecs),
          bagWeightKg: roundMoney(bagWeightKg),
          rawLotId,
        };
      });
      const taxableTotal = lineItems.reduce((total, line) => total + line.numbers.taxableValue, 0);
      const invoiceCharges = getInvoiceCharges(draft);
      const parsedChargesTotal = invoiceCharges.reduce((total, charge) => total + charge.amount, 0);
      const miscChargesTotal = presentNumber(draft.totals?.miscChargesTotal, parsedChargesTotal);
      const normalizedCharges =
        invoiceCharges.length || miscChargesTotal <= 0
          ? invoiceCharges
          : [
              {
                id: makeId('CHG', invoiceNumber),
                label: 'Miscellaneous invoice charges',
                category: 'Miscellaneous',
                amount: roundMoney(miscChargesTotal),
                allocationMethod: 'By kg',
                includeInLandedCost: true,
              },
            ];
      const landedChargeTotal =
        miscChargesTotal ||
        normalizedCharges
          .filter((charge) => charge.includeInLandedCost)
          .reduce((total, charge) => total + charge.amount, 0);
      const totalReceivedKg = lineItems.reduce((total, line) => total + line.numbers.receivedKg, 0);
      const lineItemsWithCosts = lineItems.map((line) => {
        const allocationRatio =
          totalReceivedKg > 0 ? line.numbers.receivedKg / totalReceivedKg : 1 / lineItems.length;
        const allocatedCharges = roundMoney(landedChargeTotal * allocationRatio);
        const landedCost = roundMoney(line.numbers.taxableValue + allocatedCharges);

        return {
          ...line,
          allocatedCharges,
          landedCost,
          landedCostPerKg:
            line.numbers.receivedKg > 0 ? roundMoney(landedCost / line.numbers.receivedKg) : 0,
        };
      });
      const rawLots = lineItemsWithCosts.map((line) =>
        normalizeRawLot({
          id: line.rawLotId,
          supplierId: currentSupplier.id,
          supplierName: currentSupplier.name,
          variety: line.draft.teaName.trim(),
          grade: line.grade,
          bags: line.numbers.quantity,
          bagWeightKg: line.bagWeightKg,
          bagBreakdown: line.bagBreakdown,
          bagSizeOptions: createBagSizeOptions(line.rawLotId, line.bagSpecs),
          receivedKg: line.numbers.receivedKg,
          remainingKg: line.numbers.receivedKg,
          costPerKg: line.landedCostPerKg || line.numbers.ratePerKg,
          goodsRatePerKg: line.numbers.ratePerKg,
          goodsAmount: line.numbers.taxableValue,
          acquisitionChargeShare: line.allocatedCharges,
          landedCost: line.landedCost,
          invoiceId,
          invoiceNumber,
          status: 'Active',
          reorderKg: line.numbers.reorderKg,
          receivedDate: invoiceDate,
          quality: {
            taste: 8,
            color: 8,
            aroma: 8,
          },
          movements: [
            {
              id: makeId('MOV', line.draft.teaName),
              type: 'Invoice Received',
              kg: line.numbers.receivedKg,
              note: `Invoice ${invoiceNumber} approved`,
              date: invoiceDate,
            },
          ],
        })
      );
      const cgstAmount = presentNumber(
        draft.totals?.cgstAmount,
        lineItemsWithCosts.reduce((total, line) => total + line.numbers.cgstAmount, 0)
      );
      const sgstAmount = presentNumber(
        draft.totals?.sgstAmount,
        lineItemsWithCosts.reduce((total, line) => total + line.numbers.sgstAmount, 0)
      );
      const igstAmount = presentNumber(draft.totals?.igstAmount);
      const grossTotal = presentNumber(draft.totals?.grossTotal, taxableTotal + miscChargesTotal);
      const netTotal = presentNumber(
        draft.totals?.netTotal,
        grossTotal + cgstAmount + sgstAmount + igstAmount
      );
      const invoiceRecord = {
        id: invoiceId,
        invoiceNumber,
        invoiceDate,
        supplierId: currentSupplier.id,
        supplierName: currentSupplier.name,
        vendorAddress: draft.vendor?.address?.trim() || '',
        vendorGstin,
        sourceName: draft.sourceName || '',
        sourceType: draft.sourceType || '',
        pageCount: presentNumber(draft.pageCount),
        extractionMode: draft.extractionMode || '',
        confidence: presentNumber(draft.confidence),
        taxableValue: roundMoney(presentNumber(draft.totals?.taxableValue, taxableTotal)),
        cgstAmount: roundMoney(cgstAmount),
        sgstAmount: roundMoney(sgstAmount),
        igstAmount: roundMoney(igstAmount),
        totalTaxAmount: roundMoney(cgstAmount + sgstAmount + igstAmount),
        miscChargesTotal: roundMoney(miscChargesTotal),
        charges: normalizedCharges,
        landedCostTotal: roundMoney(taxableTotal + landedChargeTotal),
        grossTotal: roundMoney(grossTotal),
        netTotal: roundMoney(netTotal),
        approvedAt: today,
        status: 'Approved',
        draftId: draft.id || '',
        correctionOfInvoiceId,
        rawLotIds: rawLots.map((lot) => lot.id),
        lineItems: lineItemsWithCosts.map((line) => ({
          teaName: line.draft.teaName.trim(),
          grade: line.grade,
          hsn: line.draft.hsn?.trim() || '',
          quantity: line.numbers.quantity,
          unit: line.draft.unit || 'Bags',
          unitWeightKg: line.numbers.unitWeightKg,
          bagBreakdown: line.bagBreakdown,
          receivedKg: line.numbers.receivedKg,
          ratePerKg: line.numbers.ratePerKg,
          taxableValue: line.numbers.taxableValue,
          allocatedCharges: line.allocatedCharges,
          landedCost: line.landedCost,
          landedCostPerKg: line.landedCostPerKg,
          cgstRate: line.numbers.cgstRate,
          cgstAmount: line.numbers.cgstAmount,
          sgstRate: line.numbers.sgstRate,
          sgstAmount: line.numbers.sgstAmount,
          igstRate: line.numbers.igstRate,
          igstAmount: line.numbers.igstAmount,
          lineTotal: line.numbers.lineTotal,
          rawLotId: line.rawLotId,
        })),
        rawText: draft.rawText || '',
      };
      const supplierAlreadyPresent = currentData.suppliers.some(
        (supplier) => supplier.id === currentSupplier.id
      );
      const suppliers = supplierAlreadyPresent
        ? currentData.suppliers.map((supplier) =>
            supplier.id === currentSupplier.id
              ? {
                  ...supplier,
                  phone: supplier.phone || currentSupplier.phone,
                  gstin: supplier.gstin || currentSupplier.gstin,
                  address: supplier.address || currentSupplier.address,
                  outstanding: roundMoney(
                    numberValue(supplier.outstanding) + invoiceRecord.netTotal
                  ),
                }
              : supplier
          )
        : [
            {
              ...currentSupplier,
              outstanding: roundMoney(invoiceRecord.netTotal),
            },
            ...currentData.suppliers,
          ];

      approvalResult = {
        invoice: invoiceRecord,
        rawLots,
      };

      const invoiceReceipts = currentData.invoiceReceipts.map((invoice) =>
        correctionOfInvoiceId && invoice.id === correctionOfInvoiceId
          ? {
              ...invoice,
              status: 'Superseded',
              supersededAt: today,
              supersededByInvoiceId: invoiceId,
            }
          : invoice
      );

      return {
        ...currentData,
        suppliers,
        rawLots: [...rawLots, ...currentData.rawLots],
        invoiceReceipts: [invoiceRecord, ...invoiceReceipts],
        invoiceDrafts: currentData.invoiceDrafts.filter((item) => item.id !== draft.id),
      };
    });

    return approvalResult;
  }

  function saveInvoiceDraft(draft) {
    const draftRecord = normalizeInvoiceDraft({
      ...draft,
      status: draft.correctionOfInvoiceId ? 'Correction Draft' : draft.status || 'Draft',
      createdAt: draft.createdAt || today,
      updatedAt: today,
    });

    setData((currentData) => {
      const draftExists = currentData.invoiceDrafts.some((item) => item.id === draftRecord.id);

      return {
        ...currentData,
        invoiceDrafts: draftExists
          ? currentData.invoiceDrafts.map((item) =>
              item.id === draftRecord.id ? draftRecord : item
            )
          : [draftRecord, ...currentData.invoiceDrafts],
      };
    });

    return draftRecord;
  }

  function deleteInvoiceDraft(draftId) {
    setData((currentData) => ({
      ...currentData,
      invoiceDrafts: currentData.invoiceDrafts.filter((draft) => draft.id !== draftId),
    }));
  }

  function getInvoiceReversalBlockers(invoiceId) {
    const invoice = data.invoiceReceipts.find((item) => item.id === invoiceId);
    return getInvoiceReversalBlockersForData(data, invoice);
  }

  function revertInvoiceReceipt(invoiceId, reason) {
    const revertReason = reason?.trim();

    if (!revertReason) {
      throw new Error('Enter a reason before reverting the invoice approval.');
    }

    const invoice = data.invoiceReceipts.find((item) => item.id === invoiceId);
    const blockers = getInvoiceReversalBlockersForData(data, invoice);

    if (blockers.length) {
      throw new Error(blockers.join(' '));
    }

    const correctionDraft = invoiceReceiptToCorrectionDraft(invoice, revertReason);

    setData((currentData) => {
      const currentInvoice = currentData.invoiceReceipts.find((item) => item.id === invoiceId);
      const currentBlockers = getInvoiceReversalBlockersForData(currentData, currentInvoice);

      if (currentBlockers.length) {
        throw new Error(currentBlockers.join(' '));
      }

      const rawLotIds = new Set(currentInvoice.rawLotIds || []);

      return {
        ...currentData,
        rawLots: currentData.rawLots.filter((lot) => !rawLotIds.has(lot.id)),
        suppliers: currentData.suppliers.map((supplier) =>
          supplier.id === currentInvoice.supplierId
            ? {
                ...supplier,
                outstanding: Math.max(
                  roundMoney(
                    numberValue(supplier.outstanding) - numberValue(currentInvoice.netTotal)
                  ),
                  0
                ),
              }
            : supplier
        ),
        invoiceReceipts: currentData.invoiceReceipts.map((item) =>
          item.id === currentInvoice.id
            ? {
                ...item,
                status: 'Reverted',
                revertedAt: today,
                revertReason,
                correctionDraftId: correctionDraft.id,
              }
            : item
        ),
        invoiceDrafts: [
          correctionDraft,
          ...currentData.invoiceDrafts.filter(
            (draft) => draft.correctionOfInvoiceId !== currentInvoice.id
          ),
        ],
      };
    });

    return correctionDraft;
  }

  function recordSupplierPayment(paymentInput, legacyAmount) {
    const supplierId = typeof paymentInput === 'object' ? paymentInput.supplierId : paymentInput;
    const amount = typeof paymentInput === 'object' ? paymentInput.amount : legacyAmount;
    const supplier = data.suppliers.find((item) => item.id === supplierId);
    const payment = numberValue(amount);
    const paymentDate =
      typeof paymentInput === 'object' ? paymentInput.paymentDate || today : today;

    if (!supplier) {
      throw new Error('Select a supplier before recording payment.');
    }

    if (payment <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    const outstanding = roundMoney(numberValue(supplier.outstanding));

    if (outstanding <= 0) {
      throw new Error(`${supplier.name} has no outstanding balance. Payment cannot be recorded.`);
    }

    if (payment > outstanding) {
      throw new Error(
        `Payment amount cannot exceed ${supplier.name}'s outstanding balance of ${outstanding}.`
      );
    }

    if (paymentDate > today) {
      throw new Error('Payment date cannot be in the future.');
    }

    const paymentRecord = {
      id: makeId('PAY', supplier.name),
      supplierId: supplier.id,
      supplierName: supplier.name,
      amount: roundMoney(payment),
      paymentDate,
      mode: typeof paymentInput === 'object' ? paymentInput.mode || 'Bank transfer' : 'Manual',
      reference: typeof paymentInput === 'object' ? paymentInput.reference?.trim() || '' : '',
      note: typeof paymentInput === 'object' ? paymentInput.note?.trim() || '' : '',
    };

    setData((currentData) => ({
      ...currentData,
      suppliers: currentData.suppliers.map((supplier) =>
        supplier.id === supplierId
          ? {
              ...supplier,
              outstanding: roundMoney(numberValue(supplier.outstanding) - payment),
            }
          : supplier
      ),
      supplierPayments: [paymentRecord, ...(currentData.supplierPayments || [])],
    }));

    return paymentRecord;
  }

  function addCustomer(form) {
    const customerName = form.name.trim();
    const phoneError = validateOptionalIndianMobile(form.phone, 'Customer phone');
    const creditLimit = numberValue(form.creditLimit, 50000);

    if (!customerName) {
      throw new Error('Customer name is required.');
    }

    if (phoneError) {
      throw new Error(phoneError);
    }

    if (creditLimit < 0) {
      throw new Error('Credit limit cannot be negative.');
    }

    if (
      data.customers.some((customer) => normalizeKey(customer.name) === normalizeKey(customerName))
    ) {
      throw new Error('This customer is already in the database.');
    }

    const customer = {
      id: makeId('CUS', customerName),
      name: customerName,
      type: form.type || 'Wholesale',
      phone: normalizeIndianMobile(form.phone),
      city: form.city?.trim() || '',
      state: form.state?.trim() || getCustomerStateForCity(form.city),
      address: form.address?.trim() || '',
      deliveryPreference: form.deliveryPreference?.trim() || 'Auto transport',
      creditLimit,
      outstanding: 0,
    };

    setData((currentData) => ({
      ...currentData,
      customers: [customer, ...currentData.customers],
    }));

    return customer;
  }

  function recordCustomerPayment(customerId, amount) {
    const payment = numberValue(amount);
    const customer = data.customers.find((item) => item.id === customerId);

    if (!customer) {
      throw new Error('Select a customer before recording payment.');
    }

    if (payment <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    if (payment > numberValue(customer.outstanding)) {
      throw new Error(
        `Payment amount cannot exceed ${customer.name}'s outstanding balance of ${roundMoney(
          numberValue(customer.outstanding)
        )}.`
      );
    }

    setData((currentData) => ({
      ...currentData,
      customers: currentData.customers.map((customer) =>
        customer.id === customerId
          ? {
              ...customer,
              outstanding: Math.max(roundMoney(numberValue(customer.outstanding) - payment), 0),
            }
          : customer
      ),
    }));
  }

  function createBlendBatch(form) {
    const preview = createBlendPreview(form, data.rawLots);
    const reservedBagIds = new Set();
    const assignedComponents = preview.components.map((component) => {
      const requestedBagCount = Math.max(Math.floor(numberValue(component.bagCount)), 0);
      const bagIds =
        component.bagSizeKg > 0 && requestedBagCount > 0
          ? getReservableBagUnitIds(
              component.lot,
              component.bagSizeKg,
              requestedBagCount,
              component.bagIds,
              reservedBagIds
            )
          : component.bagIds;

      return {
        ...component,
        bagCount: requestedBagCount || component.bagCount,
        bagIds,
      };
    });

    if (!form.productName.trim()) {
      throw new Error('Enter a blend product name.');
    }

    if (preview.batchKg <= 0) {
      throw new Error('Scan or add at least one inventory bag before creating a blend.');
    }

    const overdrawn = preview.components.find(
      (component) => component.kgUsed > component.lot.remainingKg
    );

    if (overdrawn) {
      throw new Error(`${overdrawn.lot.variety} does not have enough stock.`);
    }

    const overCount = assignedComponents.find(
      (component) =>
        component.bagSizeKg > 0 &&
        component.bagCount > getAvailableBagCount(component.lot, component.bagSizeKg)
    );

    if (overCount) {
      throw new Error(
        `${overCount.lot.variety} ${overCount.lot.grade} has only ${getAvailableBagCount(
          overCount.lot,
          overCount.bagSizeKg
        )} bag(s) available at ${overCount.bagSizeKg} kg.`
      );
    }

    const unavailableBag = assignedComponents.find((component) =>
      (component.bagIds || []).some((bagId) => {
        const unit = (component.lot.bagUnits || []).find((item) => item.id === bagId);
        return (
          !unit ||
          unit.status !== 'available' ||
          !bagSizeMatches(unit.bagSizeKg, component.bagSizeKg)
        );
      })
    );

    if (unavailableBag) {
      throw new Error('One or more scanned bag QR codes are no longer available in inventory.');
    }

    if (preview.sellingPricePerKg <= 0) {
      throw new Error('Target blend price is required for profit margin prediction.');
    }

    const blendBatchId = makeId('BLD', form.productName);
    const blendBatch = {
      id: blendBatchId,
      productName: form.productName.trim(),
      sku: (form.sku.trim() || slugify(form.productName, 'BLEND')).toUpperCase(),
      createdDate: today,
      batchKg: preview.batchKg,
      remainingKg: preview.batchKg,
      sellingPricePerKg: preview.sellingPricePerKg,
      targetBlendPricePerKg: preview.sellingPricePerKg,
      packingCostPerKg: numberValue(form.packingCostPerKg),
      laborCost: preview.laborCost,
      overheadCost: preview.overheadCost,
      rawMaterialCost: preview.rawMaterialCost,
      packingCost: preview.packingCost,
      totalCost: preview.totalCost,
      costPerKg: preview.costPerKg,
      expectedRevenue: preview.expectedRevenue,
      expectedProfit: preview.expectedProfit,
      packagingStatus: form.packagingStatus || 'Packed',
      qrPayload: JSON.stringify({
        app: 'SS-360',
        type: 'finished-blend',
        batchId: blendBatchId,
        productName: form.productName.trim(),
        sku: (form.sku.trim() || slugify(form.productName, 'BLEND')).toUpperCase(),
        remainingKg: preview.batchKg,
        costPerKg: preview.costPerKg,
        targetBlendPricePerKg: preview.sellingPricePerKg,
      }),
      components: assignedComponents.map((component) => ({
        lotId: component.lot.id,
        variety: component.lot.variety,
        grade: component.lot.grade,
        supplierName: component.lot.supplierName,
        bagSizeKg: component.bagSizeKg,
        bagCount: component.bagCount,
        bagIds: component.bagIds,
        kgUsed: component.kgUsed,
        costPerKg: component.lot.costPerKg,
        cost: component.cost,
      })),
    };

    setData((currentData) => ({
      ...currentData,
      rawLots: currentData.rawLots.map((lot) => {
        const components = blendBatch.components.filter((item) => item.lotId === lot.id);

        if (!components.length) {
          return lot;
        }

        return components.reduce(
          (nextLot, component) => consumeBlendComponentFromLot(nextLot, component, blendBatch),
          lot
        );
      }),
      blendBatches: [blendBatch, ...currentData.blendBatches],
    }));

    return blendBatch;
  }

  function createSalesOrder(form) {
    const customer =
      data.customers.find((item) => item.id === form.customerId) || form.customerSnapshot;
    const kg = numberValue(form.kg);
    const pricePerKg = numberValue(form.pricePerKg);
    const shippingCharge = numberValue(form.shippingCharge);
    const item = getInventoryItem(data, form.itemType, form.itemId);

    if (!customer || !item) {
      throw new Error('Select customer and item before creating sale.');
    }

    if (kg <= 0 || pricePerKg <= 0) {
      throw new Error('Sale kg and price must be greater than zero.');
    }

    if (shippingCharge < 0) {
      throw new Error('Shipping charge cannot be negative.');
    }

    if (kg > item.remainingKg) {
      throw new Error('Sale quantity cannot exceed available stock.');
    }

    const itemName = form.itemType === 'raw' ? `${item.variety} ${item.grade}` : item.productName;
    const revenue = calculateSaleRevenue({ kg, pricePerKg, shippingCharge });
    const cogs = roundMoney(kg * getItemCostPerKg(form.itemType, item));
    const paymentMode = form.paymentMode || 'Credit';
    const paidAmount =
      form.amountPaid === undefined
        ? paymentMode === 'Credit'
          ? 0
          : revenue
        : numberValue(form.amountPaid);

    if (paidAmount < 0) {
      throw new Error('Paid amount cannot be negative.');
    }

    if (paidAmount > revenue) {
      throw new Error('Paid amount cannot exceed sale revenue.');
    }

    const balanceDue = roundMoney(revenue - paidAmount);
    const order = {
      id: makeId('SO', itemName),
      customerId: customer.id,
      customerName: customer.name,
      itemType: form.itemType,
      itemId: item.id,
      itemName,
      kg,
      pricePerKg,
      shippingCharge,
      revenue,
      cogs,
      profit: roundMoney(revenue - cogs),
      orderDate: form.orderDate || today,
      status: 'Packed',
      saleType: form.saleType || customer.type,
      paymentMode,
      paidAmount: roundMoney(paidAmount),
      balanceDue,
      paymentStatus: balanceDue > 0 ? 'Due' : 'Paid',
    };
    const shipment = {
      id: makeId('SHIP', customer.name),
      orderId: order.id,
      customerName: customer.name,
      destination: customer.address || customer.city,
      transportMode: form.transportMode || customer.deliveryPreference,
      vehicleNo: '',
      status: 'Packed',
      packedDate: form.orderDate || today,
      shippedDate: '',
      deliveredDate: '',
      note: form.note || '',
    };

    setData((currentData) => {
      const currentItem = getInventoryItem(currentData, form.itemType, form.itemId);

      if (!currentItem || kg > numberValue(currentItem.remainingKg)) {
        throw new Error('Sale quantity cannot exceed available stock.');
      }

      return {
        ...currentData,
        rawLots:
          form.itemType === 'raw'
            ? currentData.rawLots.map((lot) =>
                lot.id === currentItem.id
                  ? {
                      ...lot,
                      remainingKg: roundMoney(lot.remainingKg - kg),
                      movements: [
                        {
                          id: makeId('MOV', lot.variety),
                          type: 'Direct Sale',
                          kg: -kg,
                          note: `${order.id} sold to ${customer.name}`,
                          date: order.orderDate,
                        },
                        ...lot.movements,
                      ],
                    }
                  : lot
              )
            : currentData.rawLots,
        blendBatches:
          form.itemType === 'blend'
            ? currentData.blendBatches.map((batch) =>
                batch.id === currentItem.id
                  ? {
                      ...batch,
                      remainingKg: roundMoney(batch.remainingKg - kg),
                    }
                  : batch
              )
            : currentData.blendBatches,
        salesOrders: [order, ...currentData.salesOrders],
        shipments: [shipment, ...currentData.shipments],
        customers: currentData.customers.some(
          (currentCustomer) => currentCustomer.id === customer.id
        )
          ? currentData.customers.map((currentCustomer) =>
              currentCustomer.id === customer.id
                ? {
                    ...currentCustomer,
                    outstanding: roundMoney(numberValue(currentCustomer.outstanding) + balanceDue),
                  }
                : currentCustomer
            )
          : [
              {
                ...customer,
                outstanding: balanceDue,
              },
              ...currentData.customers,
            ],
      };
    });

    return order;
  }

  function updateShipment(form) {
    const shipment = data.shipments.find((item) => item.id === form.shipmentId);

    if (!shipment) {
      throw new Error('Select a shipment to update.');
    }

    const nextStatus = form.status || shipment.status;

    setData((currentData) => ({
      ...currentData,
      shipments: currentData.shipments.map((item) =>
        item.id === shipment.id
          ? {
              ...item,
              transportMode: form.transportMode || item.transportMode,
              vehicleNo: form.vehicleNo || item.vehicleNo,
              status: nextStatus,
              shippedDate:
                nextStatus === 'Dispatched' && !item.shippedDate
                  ? today
                  : item.shippedDate || form.shippedDate,
              deliveredDate:
                nextStatus === 'Delivered' && !item.deliveredDate
                  ? today
                  : item.deliveredDate || form.deliveredDate,
              note: form.note || item.note,
            }
          : item
      ),
      salesOrders: currentData.salesOrders.map((order) =>
        order.id === shipment.orderId
          ? {
              ...order,
              status: nextStatus,
            }
          : order
      ),
    }));
  }

  const value = {
    data: dataWithCustomerStates,
    metrics,
    today,
    numberValue,
    roundMoney,
    getRawLotBagOptions,
    getAvailableBagCount,
    createBlendPreview,
    addSupplier,
    approveInvoiceReceipt,
    saveInvoiceDraft,
    deleteInvoiceDraft,
    revertInvoiceReceipt,
    getInvoiceReversalBlockers,
    recordSupplierPayment,
    addCustomer,
    recordCustomerPayment,
    createBlendBatch,
    createSalesOrder,
    updateShipment,
  };

  return <EnterpriseContext.Provider value={value}>{children}</EnterpriseContext.Provider>;
}

export function useEnterprise() {
  const context = useContext(EnterpriseContext);

  if (!context) {
    throw new Error('useEnterprise must be used inside EnterpriseProvider');
  }

  return context;
}
