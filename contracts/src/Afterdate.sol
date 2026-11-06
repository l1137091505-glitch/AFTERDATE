// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Afterdate
/// @notice Timed fair exchange of a 32-byte decryption key for native BOT.
contract Afterdate {
    enum State { Available, Locked, Revealed, Refunded, Cancelled }

    struct Listing {
        address seller;
        address buyer;
        uint128 price;
        uint64 revealWindow;
        uint64 deadline;
        State state;
        bytes32 payloadHash;
        bytes32 keyHash;
        bytes32 key;
        string label;
    }

    uint256 public listingCount;
    mapping(uint256 => Listing) private listings;
    mapping(address => uint256) public pending;
    uint256 private locked = 1;

    event Listed(uint256 indexed id, address indexed seller, uint256 price, bytes32 payloadHash, bytes32 keyHash, string label);
    event Bought(uint256 indexed id, address indexed buyer, uint64 deadline);
    event Revealed(uint256 indexed id, bytes32 key);
    event Refunded(uint256 indexed id);
    event Cancelled(uint256 indexed id);
    event Withdrawn(address indexed account, uint256 amount);

    error InvalidInput();
    error WrongState();
    error Unauthorized();
    error WrongPayment();
    error WrongKey();
    error TooLate();
    error NotLate();
    error TransferFailed();

    modifier nonReentrant() {
        require(locked == 1, "REENTRANCY");
        locked = 2;
        _;
        locked = 1;
    }

    function list(bytes32 payloadHash, bytes32 keyHash, uint128 price, uint64 revealWindow, string calldata label) external returns (uint256 id) {
        if (payloadHash == bytes32(0) || keyHash == bytes32(0) || price == 0 || revealWindow < 1 hours || revealWindow > 90 days || bytes(label).length == 0 || bytes(label).length > 80) revert InvalidInput();
        id = ++listingCount;
        listings[id] = Listing(msg.sender, address(0), price, revealWindow, 0, State.Available, payloadHash, keyHash, bytes32(0), label);
        emit Listed(id, msg.sender, price, payloadHash, keyHash, label);
    }

    function buy(uint256 id) external payable {
        Listing storage item = listings[id];
        if (item.state != State.Available) revert WrongState();
        if (msg.sender == item.seller) revert Unauthorized();
        if (msg.value != item.price) revert WrongPayment();
        item.buyer = msg.sender;
        item.deadline = uint64(block.timestamp) + item.revealWindow;
        item.state = State.Locked;
        emit Bought(id, msg.sender, item.deadline);
    }

    function reveal(uint256 id, bytes32 key) external {
        Listing storage item = listings[id];
        if (item.state != State.Locked) revert WrongState();
        if (msg.sender != item.seller) revert Unauthorized();
        if (block.timestamp > item.deadline) revert TooLate();
        if (keccak256(abi.encodePacked(key)) != item.keyHash) revert WrongKey();
        item.key = key;
        item.state = State.Revealed;
        pending[item.seller] += item.price;
        emit Revealed(id, key);
    }

    function refund(uint256 id) external {
        Listing storage item = listings[id];
        if (item.state != State.Locked) revert WrongState();
        if (msg.sender != item.buyer) revert Unauthorized();
        if (block.timestamp <= item.deadline) revert NotLate();
        item.state = State.Refunded;
        pending[item.buyer] += item.price;
        emit Refunded(id);
    }

    function cancel(uint256 id) external {
        Listing storage item = listings[id];
        if (item.state != State.Available) revert WrongState();
        if (msg.sender != item.seller) revert Unauthorized();
        item.state = State.Cancelled;
        emit Cancelled(id);
    }

    function withdraw() external nonReentrant {
        uint256 amount = pending[msg.sender];
        if (amount == 0) revert InvalidInput();
        pending[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    function listingOf(uint256 id) external view returns (Listing memory) {
        if (id == 0 || id > listingCount) revert InvalidInput();
        return listings[id];
    }
}
