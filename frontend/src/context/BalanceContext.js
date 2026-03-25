'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

const BalanceContext = createContext();

export function BalanceProvider({ children }) {
    const [balance, setBalance] = useState('0');

    useEffect(() => {
        const savedBalance = localStorage.getItem('user_balance');
        if (savedBalance) {
            setBalance(savedBalance);
        }
    }, []);

    const updateBalance = (newBalance) => {
        setBalance(newBalance);
        localStorage.setItem('user_balance', newBalance);
    };

    return (
        <BalanceContext.Provider value={{ balance, updateBalance }}>
            {children}
        </BalanceContext.Provider>
    );
}

export function useBalance() {
    const context = useContext(BalanceContext);
    if (context === undefined) {
        throw new Error('useBalance must be used within a BalanceProvider');
    }
    return context;
}
