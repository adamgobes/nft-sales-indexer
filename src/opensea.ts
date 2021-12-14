import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  AtomicMatch_Call,
  AtomicMatch_Call__Inputs,
  WyvernExchange,
} from "../generated/WyvernExchange/WyvernExchange"
import { WYVERN_ATOMICIZER_ADDRESS, WYVERN_EXCHANGE_ADDRESS } from "./constants";
import { _createSaleEntityFromParams } from "./shared";

class NFT {
  constructor(public contractAddress: Bytes, public tokenId: string) {
    this.contractAddress = contractAddress;
    this.tokenId = tokenId
  }
}

/** Call handlers */
/**
 * 
 * @param call The AtomicMatch call that triggered this call handler.   
 * @description When a sale is made on OpenSea an AtomicMatch_ call is invoked.
 *              This handler will create the associated OpenSeaSale entity
 */
export function handleAtomicMatch_(call: AtomicMatch_Call): void {
  let addrs: Address[] = call.inputs.addrs;
  let saleAdress: Address = addrs[11];
  let saleTargetAddressStr: string = saleAdress.toHexString();


  if (saleTargetAddressStr == WYVERN_ATOMICIZER_ADDRESS) {
    /**
        * When dealing with bundle sale, the targeted sale address is
        * the address of the OpenSea Atomicizer (that will atomically 
        * call every transferFrom methods of each NFT contract involved 
        * in the bundle).
        * 
        */
    _handleBundleSale(call);
  }
  else {
    /**
         * In case of normal "single asset sale", the saleTarget input is
         * set to the NFT contract.
         */
    _handleSingleAssetSale(call);
  }
}


/** Private implementation */

/**
 * 
 * @param call The AtomicMatch call that triggered the handleAtomicMatch_ call handler.
 * @description This function is used to handle the case of a "normal" sale made from OpenSea.
 *              A "normal" sale is a sale that is not a bundle (only contains one asset).
 */
function _handleSingleAssetSale(call: AtomicMatch_Call): void {
  let callInputs = call.inputs;
  let addrs: Address[] = callInputs.addrs;
  let uints: BigInt[] = callInputs.uints;

  let wyvernExchange = WyvernExchange.bind(Address.fromString(WYVERN_EXCHANGE_ADDRESS))

  let price: BigInt = _getMatchPriceOfSale(wyvernExchange, callInputs)

  let nftAddrs: Address = addrs[4];

  let buyerAdress: Address = addrs[1]; // Buyer.maker
  let sellerAdress: Address = addrs[8]; // Saler.maker
  let paymentTokenErc20Address: Address = addrs[6];

  let mergedCallData = _guardedArrayReplace(wyvernExchange, callInputs)
  if (!mergedCallData) return

  // Fetch the token ID that has been sold from the call data 
  let tokenId = _getSingleTokenIdFromTransferFromCallData(mergedCallData.toHexString(), true);

  // Create the Sale
  let saleId = call.transaction.hash.toHexString();
  _createSaleEntityFromParams(saleId, "Single", WYVERN_EXCHANGE_ADDRESS, call.block, buyerAdress, sellerAdress, paymentTokenErc20Address, price, nftAddrs, tokenId)
}

/**
 * 
 * @param call The AtomicMatch call that triggered the handleAtomicMatch_ call handler.
 * @description This function is used to handle the case of a "bundle" sale made from OpenSea.
 *              A "bundle" sale is a sale that contains several assets embeded in the same, atomic, transaction.
 */
function _handleBundleSale(call: AtomicMatch_Call): void {
  let callInputs = call.inputs;
  let addrs: Address[] = callInputs.addrs;
  let uints: BigInt[] = callInputs.uints;

  let wyvernExchange = WyvernExchange.bind(Address.fromString(WYVERN_EXCHANGE_ADDRESS))

  let price: BigInt = _getMatchPriceOfSale(wyvernExchange, callInputs)

  let buyerAdress: Address = addrs[1]; // Buyer.maker
  let sellerAdress: Address = addrs[8]; // Saler.maker
  let paymentTokenErc20Address: Address = addrs[6];

  let mergedCallData = _guardedArrayReplace(wyvernExchange, callInputs)
  if (!mergedCallData) return

  // Fetch the token IDs list that has been sold from the call data for this bundle sale
  let completeNfts = _getCompleteNftIdFromCallData(mergedCallData);

  for (let i = 0; i < completeNfts.length; i++) {
    let completeNftId = completeNfts[i];
    // Create the sale
    let saleId = `${call.transaction.hash.toHexString()}<>${completeNftId.contractAddress.toHexString()}<>${completeNftId.tokenId}`;
    _createSaleEntityFromParams(saleId, "Bundle", WYVERN_EXCHANGE_ADDRESS, call.block, buyerAdress, sellerAdress, paymentTokenErc20Address, price, completeNftId.contractAddress, completeNftId.tokenId)
  }
}

/**
 * Replace bytes in an array with bytes in another array, guarded by a bitmask
 *
 * @param wyvernExchange WyvernExchange contract
 * @param callInputs inputs to original AtomicMatch contract call to pass through
 * @returns The updated byte array or null if contract call was reverted
 */
function _guardedArrayReplace(wyvernExchange: WyvernExchange, callInputs: AtomicMatch_Call__Inputs): Bytes | null {
  // Merge sell order data with buy order data (just like they are doing in their contract)
  let mergedCallData: Bytes
  let mergedCallDataTxResult = wyvernExchange.try_guardedArrayReplace(callInputs.calldataBuy, callInputs.calldataSell, callInputs.replacementPatternBuy);
  if (mergedCallDataTxResult.reverted) {
    return null // cannot continue with the entity if guardedArrayReplace fails, so just return
  } else {
    return mergedCallDataTxResult.value
  }
}

/**
 * Replace bytes in an array with bytes in another array, guarded by a bitmask
 *
 * @param wyvernExchange WyvernExchange contract
 * @param callInputs inputs to original AtomicMatch contract call to pass through
 * @returns The price at which the sale occured in the native payment token
 */
function _getMatchPriceOfSale(wyvernExchange: WyvernExchange, callInputs: AtomicMatch_Call__Inputs): BigInt {
  let priceTxResult = wyvernExchange.try_calculateMatchPrice_(callInputs.addrs, callInputs.uints, callInputs.feeMethodsSidesKindsHowToCalls, callInputs.calldataBuy, callInputs.calldataSell, callInputs.replacementPatternBuy, callInputs.replacementPatternSell, callInputs.staticExtradataBuy, callInputs.staticExtradataSell)
  if (priceTxResult.reverted) {
    return callInputs.uints[4] // fall back to default match price (may be incorrect in case of timed auction)
  } else {
    return priceTxResult.value
  }
}

/**
 * 
 * @param atomicizeCallData The ABI encoded atomicize method call used by OpenSea Smart library (WyvernAtomicizer)
 *                          to trigger bundle sales (looping over NFT and calling transferFrom for each)
 * @returns The list of associated full name NFT in the bundle
 */
function _getCompleteNftIdFromCallData(atomicizeCallData: Bytes): NFT[] {
  const TRAILING_0x = 2;
  const METHOD_ID_LENGTH = 8;
  const UINT_256_LENGTH = 64;

  let indexStartNbToken = TRAILING_0x + METHOD_ID_LENGTH + UINT_256_LENGTH * 4;
  let indexStopNbToken = indexStartNbToken + UINT_256_LENGTH;
  let nbTokenStr = atomicizeCallData.toHexString().substring(indexStartNbToken, indexStopNbToken);
  let nbToken = i32(parseInt(nbTokenStr, 16))

  // Get the associated NFT contracts
  let nftContractsAddrsList: string[] = [];
  let offset = indexStopNbToken;
  for (let i = 0; i < nbToken; i++) {
    let addrs = atomicizeCallData.toHexString().substring(offset, offset + UINT_256_LENGTH);
    nftContractsAddrsList.push(addrs);

    // Move forward in the call data
    offset += UINT_256_LENGTH;
  }

  /**
   * After reading the contract addresses involved in the bundle sale
   * there are 2 chunks of params of length nbToken * UINT_256_LENGTH.
   * 
   * Those chunks are each preceded by a "chunk metadata" of length UINT_256_LENGTH
   * Finalluy a last "chunk metadata" is set of length UINT_256_LENGTH. (3 META_CHUNKS)
   *  
   * 
   * After that we are reading the abiencoded data representing the transferFrom calls
   */
  const LEFT_CHUNKS = 2;
  const NB_META_CHUNKS = 3;
  offset += nbToken * UINT_256_LENGTH * LEFT_CHUNKS + NB_META_CHUNKS * UINT_256_LENGTH;

  // Get the NFT token IDs
  const TRANSFER_FROM_DATA_LENGTH = METHOD_ID_LENGTH + UINT_256_LENGTH * 3;
  let tokenIdsList: string[] = [];
  for (let i = 0; i < nbToken; i++) {
    let transferFromData = atomicizeCallData.toHexString().substring(offset, offset + TRANSFER_FROM_DATA_LENGTH);
    let tokenIdstr = _getSingleTokenIdFromTransferFromCallData(transferFromData, false);
    tokenIdsList.push(tokenIdstr);

    // Move forward in the call data
    offset += TRANSFER_FROM_DATA_LENGTH;
  }

  // Build the complete Nfts Ids (NFT contract - Token ID)
  let completeNftList: NFT[] = [];
  for (let i = 0; i < nftContractsAddrsList.length; i++) {
    let contractAddrs = nftContractsAddrsList[i];
    let tokenId = tokenIdsList[i];

    // get shortened hex format of contract address (40 chars rather than 64)
    contractAddrs = `0x${contractAddrs.substring(contractAddrs.length - 40)}`

    completeNftList.push(new NFT(Address.fromByteArray(Address.fromHexString(contractAddrs)), tokenId));
  }

  return completeNftList;
}

/**
 * 
 * @param transferFromData The ABI encoded transferFrom method call used by OpenSea Smart contract 
 *                 to trigger the Nft transfer between the seller and the buyer
 * @returns The tokenId (string) of the transfer
 */
function _getSingleTokenIdFromTransferFromCallData(transferFromData: string, trailing0x: boolean): string {
  let TRAILING_0x = trailing0x ? 2 : 0;
  const METHOD_ID_LENGTH = 8;
  const UINT_256_LENGTH = 64;

  /**
   * The calldata input is formated as:
   * Format => METHOD_ID (transferFrom) | FROM | TO | TOKEN_ID
   * Size   =>            X             |   Y  |  Y |    Y
   *      Where :
   *          - X = 32 bits (8 hex chars)
   *          - Y = 256 bits (64 hex chars)
   * 
   * +2 | 0 chars for the "0x" leading part
   */

  let tokenIdHex = transferFromData.substring(TRAILING_0x + METHOD_ID_LENGTH + UINT_256_LENGTH * 2);

  let tokenId = parseInt(tokenIdHex.toString(), 16).toString()

  return tokenId.substring(0, tokenId.indexOf("."));
}