import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

declare global {
  interface Window {
    ethereum?: {
      isMetaMask: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (params: any) => void) => void;
      removeListener: (event: string, callback: (params: any) => void) => void;
      networkVersion: string;
    };
  }
}

interface NetworkInfo {
  chainId: string;
  name: string;
}

export const useWallet = () => {
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const getNetworkInfo = async (chainId: string): Promise<NetworkInfo> => {
    const networks: { [key: string]: string } = {
      '1': 'Ethereum Mainnet',
      '5': 'Goerli Testnet',
      '11155111': 'Sepolia Testnet',
      '137': 'Polygon Mainnet',
      '80001': 'Mumbai Testnet',
    };
    return {
      chainId,
      name: networks[chainId] || `Chain ID: ${chainId}`,
    };
  };

  const updateBalance = async (address: string) => {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const balanceWei = await provider.getBalance(address);
      const ethBalance = ethers.utils.formatEther(balanceWei);
      setBalance(parseFloat(ethBalance).toFixed(4));
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  const updateNetwork = async () => {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const net = await provider.getNetwork();
      const networkInfo = await getNetworkInfo(net.chainId.toString());
      setNetwork(networkInfo);
    } catch (err) {
      console.error('Error fetching network:', err);
    }
  };

  const saveWalletAddressToDB = async (walletAddress: string) => {
    try {
      const response = await fetch('http://localhost:4000/api/v1/save-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });
      if (!response.ok) throw new Error('Failed to save wallet');
      console.log('✅ Wallet address saved to DB');
    } catch (err) {
      console.error('Error saving wallet address:', err);
    }
  };

  useEffect(() => {
    setIsMetaMaskInstalled(!!window.ethereum?.isMetaMask);

    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            const address = accounts[0];
            setAccount(address);
            await updateBalance(address);
            await updateNetwork();
          }
        } catch (err) {
          console.error('Error checking connection:', err);
        }
      }
    };

    checkConnection();

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        setAccount(null);
        setBalance('0');
        setNetwork(null);
      } else {
        const address = accounts[0];
        setAccount(address);
        await updateBalance(address);
        await saveWalletAddressToDB(address);
      }
    };

    const handleChainChanged = () => {
      if (account) {
        updateBalance(account);
        updateNetwork();
      }
    };

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [account]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('MetaMask is not installed');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();

      setAccount(address);
      await updateBalance(address);
      await updateNetwork();
      await saveWalletAddressToDB(address);

      setIsOpen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
      console.error('Error connecting wallet:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setBalance('0');
    setNetwork(null);
    setIsOpen(false);
  };

  const toggleWalletMenu = () => {
    setIsOpen(!isOpen);
  };

  return {
    isMetaMaskInstalled,
    account,
    isConnecting,
    error,
    balance,
    network,
    isOpen,
    connectWallet,
    disconnectWallet,
    toggleWalletMenu,
  };
};