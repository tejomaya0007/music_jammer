import { BACKEND } from '../config';
import type { Backend } from './types';
import { supabaseBackend } from './supabase';
import { mockBackend } from './mock';

/** One env flag decides the backend: VITE_BACKEND=supabase (default) or mock. */
export const backend: Backend = BACKEND === 'mock' ? mockBackend : supabaseBackend;
export type { Backend } from './types';
