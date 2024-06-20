class Queue {
	constructor() {
		this.items = {}
		this.frontIndex = 0
		this.backIndex = 0
	}
	enqueue(item) {
		this.items[this.backIndex] = item
		this.backIndex++
		return item
	}
	dequeue() {
		const item = this.items[this.frontIndex]
		if (item) {
			delete this.items[this.frontIndex]
			this.frontIndex++
			return item
		}
		return undefined;

	}
	peek() {
		return this.items[this.frontIndex]
	}
	get printQueue() {
		return this.items;
	}


}

const queue = new Queue();

module.exports = queue;