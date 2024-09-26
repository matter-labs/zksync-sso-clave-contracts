interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface Serializer<T> {
  read(value: string): T;
  write(value: T): string;
}

const StorageSerializers = {
  object: {
    read: <T>(v: string): T => {
      try {
        return JSON.parse(v) as T;
      } catch {
        throw new Error("Failed to parse JSON");
      }
    },
    write: <T>(v: T): string => JSON.stringify(v),
  },
};

type ChangeListener<T> = (newValue: T, oldValue: T) => void;

interface StorageItemOptions<T> {
  storage?: StorageLike;
  serializer?: Serializer<T>;
  onChange?: ChangeListener<T>;
}

export class StorageItem<T> {
  key: string;
  defaultValue: T;
  storage: StorageLike;
  serializer: Serializer<T>;
  private onChangeCallback?: ChangeListener<T>;

  constructor(
    key: string,
    defaultValue: T,
    options: StorageItemOptions<T> = {},
  ) {
    this.key = key;
    this.defaultValue = defaultValue;
    this.storage = options.storage || localStorage;
    this.serializer = options.serializer || StorageSerializers.object;

    if (options.onChange) {
      this.onChangeCallback = options.onChange;
    }
  }

  static scopedStorageKey = (key: string) => `ZKAccount::${key}`;

  get(): T {
    const storedValue = this.storage.getItem(this.key);
    if (storedValue !== null) {
      try {
        return this.serializer.read(storedValue);
      } catch {
        return this.defaultValue;
      }
    }
    return this.defaultValue;
  }

  set(value: T): void {
    const oldValue = this.get();
    const serializedValue = this.serializer.write(value);
    this.storage.setItem(this.key, serializedValue);
    this.notifyChange(value, oldValue);
  }

  remove(): void {
    const oldValue = this.get();
    this.storage.removeItem(this.key);
    this.notifyChange(this.defaultValue, oldValue);
  }

  private notifyChange(newValue: T, oldValue: T): void {
    if (this.onChangeCallback) {
      this.onChangeCallback(newValue, oldValue);
    }
  }
}
